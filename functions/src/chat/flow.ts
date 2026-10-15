import {HttpsError, onCallGenkit} from "firebase-functions/https";
import {logger} from "firebase-functions";
import {z} from "genkit";
import {parsePartialJson} from "genkit/extract";
import {simulateConstrainedGeneration} from "genkit/model";
import {
  ANSWER_MODE,
  CATALOG_LIMIT,
  CHAT_MODEL,
  DISCLAIMER,
  MAX_TURNS,
} from "../config";
import {ai, geminiKey} from "../genkit";
import {requireMember} from "../shared/auth";
import {documentsCol, ID_PATTERN, orgRef} from "../shared/paths";
import {
  AnswerSchema,
  AskChunkSchema,
  AskInputSchema,
  AskResultSchema,
  type SearchRecord,
} from "../shared/schemas";
import {
  addAssistantMessage,
  addUserMessage,
  getOrCreateConversation,
  loadHistory,
} from "./history";
import {buildSystemPrompt, type CatalogEntry} from "./prompt";
import {vectorSearch} from "./retrieval";
import {SourceRegistry} from "./sources";

const loadCatalog = async (orgId: string): Promise<CatalogEntry[]> => {
  const snapshot = await documentsCol(orgId)
    .where("status", "==", "indexed")
    .orderBy("createdAt", "desc")
    .limit(CATALOG_LIMIT)
    .get();
  return snapshot.docs.map((doc) => ({
    documentId: doc.id,
    title: doc.get("title"),
    category: doc.get("classification.category"),
    jurisdiction: doc.get("classification.jurisdiction") ?? null,
    effectiveDate: doc.get("classification.effectiveDate") ?? null,
    summary: doc.get("classification.summary") ?? "",
  }));
};

const SearchInputSchema = z.object({
  query: z.string().describe("What to look for, in specific terms"),
  scope: z.enum(["policy", "law", "precedent"]).optional().describe(
    "policy: code of conduct, company policies and guidance. law: laws " +
    "and regulations. precedent: records of past cases. Omit to search " +
    "everything."
  ),
  documentId: z.string().optional().describe(
    "Restrict the search to one document from the catalog"
  ),
});

const PassageSchema = z.object({
  ref: z.number().int(),
  title: z.string(),
  category: z.string(),
  jurisdiction: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  section: z.string().nullable(),
  page: z.number().int().nullable(),
  text: z.string(),
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const askIsLegalFlow = ai.defineFlow(
  {
    name: "askIsLegal",
    inputSchema: AskInputSchema,
    outputSchema: AskResultSchema,
    streamSchema: AskChunkSchema,
  },
  async (input, {context, sendChunk}) => {
    const started = Date.now();
    // orgId comes only from the verified token, never from the request.
    const {uid, orgId} = requireMember(context?.auth);

    const [org, catalog] = await Promise.all([
      orgRef(orgId).get(),
      loadCatalog(orgId),
    ]);
    if (!org.exists) {
      throw new HttpsError("failed-precondition", "Organization not found.");
    }
    const conversation = await getOrCreateConversation(
      orgId, uid, input.conversationId, input.message
    );
    const history = conversation.isNew ?
      [] :
      await loadHistory(conversation.ref);
    sendChunk({type: "meta", conversationId: conversation.ref.id});
    await addUserMessage(conversation.ref, uid, input.message);

    // Built per request so the tool is bound to this caller's org and this
    // turn's source numbering; the model never sees or chooses the orgId.
    const registry = new SourceRegistry();
    const searches: SearchRecord[] = [];
    const searchDocuments = ai.dynamicTool(
      {
        name: "searchDocuments",
        description:
          "Searches the organization's indexed documents (policies, laws, " +
          "past cases) and returns the most relevant passages, each with a " +
          "ref number to cite as [ref].",
        inputSchema: SearchInputSchema,
        outputSchema: z.object({
          passages: z.array(PassageSchema),
          note: z.string().optional(),
        }),
      },
      async ({query, scope, documentId}) => {
        const docFilter = documentId && ID_PATTERN.test(documentId) ?
          documentId :
          undefined;
        const hits = await vectorSearch(orgId, query, {
          scope,
          documentId: docFilter,
        });
        const passages = hits.map((hit) => ({
          ref: registry.add(hit),
          title: hit.title,
          category: hit.category,
          jurisdiction: hit.jurisdiction,
          effectiveDate: hit.effectiveDate,
          section: hit.heading,
          page: hit.page,
          text: hit.text,
        }));
        searches.push({
          query,
          scope: scope ?? null,
          documentId: docFilter ?? null,
          resultCount: passages.length,
        });
        sendChunk({
          type: "search",
          query,
          scope: scope ?? null,
          results: passages.map(({ref, title}) => ({ref, title})),
        });
        return passages.length ?
          {passages} :
          {
            passages,
            note: "No relevant passages. Try other wording or another scope.",
          };
      }
    );

    try {
      const {stream, response} = ai.generateStream({
        system: buildSystemPrompt({
          orgName: org.get("name") ?? orgId,
          defaultJurisdiction: org.get("defaultJurisdiction") ?? null,
          catalog,
          today: new Date().toISOString().slice(0, 10),
        }),
        messages: history,
        prompt: input.message,
        tools: [searchDocuments],
        output: {schema: AnswerSchema},
        maxTurns: MAX_TURNS,
        config: {temperature: 0.2},
        use: ANSWER_MODE === "simulated" ?
          [simulateConstrainedGeneration()] :
          undefined,
      });

      // Genkit's own chunk.output accumulates text across every model turn
      // (including any text written alongside tool calls), so parse each
      // turn's text separately.
      const buffers = new Map<number, string>();
      let lastSentAt = 0;
      let lastSent = "";
      for await (const chunk of stream) {
        if (chunk.role !== "model" || !chunk.text) continue;
        const text = (buffers.get(chunk.index) ?? "") + chunk.text;
        buffers.set(chunk.index, text);
        if (Date.now() - lastSentAt < 100) continue;
        let partial: unknown;
        try {
          partial = parsePartialJson(text);
        } catch {
          continue;
        }
        if (!isPlainObject(partial)) continue;
        const serialized = JSON.stringify(partial);
        if (serialized === lastSent) continue;
        lastSent = serialized;
        lastSentAt = Date.now();
        sendChunk({type: "answer", partial});
      }

      const result = await response;
      const output = result.output;
      if (!output) {
        throw new Error(
          `No structured answer (finish reason: ${result.finishReason})`
        );
      }
      const {answer, citations} = registry.resolve(AnswerSchema.parse(output));
      const message = await addAssistantMessage(conversation.ref, {
        uid,
        answer,
        citations,
        searches,
        model: CHAT_MODEL,
        latencyMs: Date.now() - started,
      });
      logger.info("Answered", {
        orgId,
        conversationId: conversation.ref.id,
        verdict: answer.verdict,
        searches: searches.length,
        citations: citations.length,
        latencyMs: Date.now() - started,
      });
      return {
        conversationId: conversation.ref.id,
        messageId: message.id,
        answer,
        citations,
        disclaimer: DISCLAIMER,
      };
    } catch (error) {
      logger.error("askIsLegal failed", {orgId, error});
      // Record the failure so the conversation doesn't end on an unanswered
      // question.
      await addAssistantMessage(conversation.ref, {
        uid,
        searches,
        error: "Sorry, I couldn't answer that. Please try again.",
        model: CHAT_MODEL,
        latencyMs: Date.now() - started,
      }).catch(() => undefined);
      throw new HttpsError(
        "internal",
        "The assistant couldn't produce an answer. Please try again."
      );
    }
  }
);

export const askIsLegal = onCallGenkit(
  {secrets: [geminiKey], timeoutSeconds: 300, memory: "512MiB"},
  askIsLegalFlow
);
