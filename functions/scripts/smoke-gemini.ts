// Checks the Gemini capabilities the prototype relies on, against the live
// API (no emulators needed):
//   1. Embeddings with a task type at 768 dimensions, for each candidate model.
//   2. One generate call combining a tool with the structured answer schema,
//      in both native and simulated modes.
// Run: npm --prefix functions run smoke:gemini
import {googleAI} from "@genkit-ai/google-genai";
import {z} from "genkit";
import {simulateConstrainedGeneration} from "genkit/model";
import {CHAT_MODEL, EMBED_DIMS} from "../src/config";
import {ai} from "../src/genkit";
import {AnswerSchema} from "../src/shared/schemas";
import {loadGeminiKey} from "./load-secret";

loadGeminiKey();
if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error("Set GOOGLE_GENAI_API_KEY or create functions/.secret.local");
  process.exit(1);
}

const results: Array<{check: string; ok: boolean; detail: string}> = [];
const record = (check: string, ok: boolean, detail: string) => {
  results.push({check, ok, detail});
  console.log(`${ok ? "PASS" : "FAIL"}  ${check}: ${detail}`);
};

const checkEmbedder = async (
  model: "gemini-embedding-001" | "gemini-embedding-2"
) => {
  const taskTypes = ["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"] as const;
  for (const taskType of taskTypes) {
    try {
      const [result] = await ai.embed({
        embedder: googleAI.embedder(model),
        content: "Employees may accept gifts worth up to USD 50.",
        options: {taskType, outputDimensionality: EMBED_DIMS},
      });
      const dims = result.embedding.length;
      record(`${model} ${taskType}`, dims === EMBED_DIMS, `${dims} dims`);
    } catch (error) {
      record(`${model} ${taskType}`, false, String(error));
    }
  }
};

const checkToolsWithSchema = async (mode: "native" | "simulated") => {
  let toolCalls = 0;
  const lookup = ai.dynamicTool(
    {
      name: "searchDocuments",
      description: "Searches company policy. Returns passages with refs.",
      inputSchema: z.object({query: z.string()}),
      outputSchema: z.object({
        passages: z.array(z.object({ref: z.number(), text: z.string()})),
      }),
    },
    async () => {
      toolCalls++;
      return {
        passages: [{
          ref: 1,
          text: "Gifts and Entertainment Policy, section 4: employees may " +
            "accept gifts up to USD 50. Anything above requires Compliance " +
            "approval. Never accept cash.",
        }],
      };
    }
  );
  try {
    const response = await ai.generate({
      model: googleAI.model(CHAT_MODEL),
      system: "You are a compliance assistant. Always call searchDocuments " +
        "before answering, then answer citing passages as [ref].",
      prompt: "A vendor offered me a USD 120 bottle of wine. Can I accept?",
      tools: [lookup],
      output: {schema: AnswerSchema},
      maxTurns: 4,
      use: mode === "simulated" ? [simulateConstrainedGeneration()] : undefined,
    });
    const parsed = AnswerSchema.safeParse(response.output);
    record(
      `${CHAT_MODEL} tools + schema (${mode})`,
      toolCalls > 0 && parsed.success,
      `toolCalls=${toolCalls} parsed=${parsed.success} ` +
        `verdict=${parsed.success ? parsed.data.verdict : "-"}`
    );
  } catch (error) {
    record(`${CHAT_MODEL} tools + schema (${mode})`, false, String(error));
  }
};

const main = async () => {
  await checkEmbedder("gemini-embedding-001");
  await checkEmbedder("gemini-embedding-2");
  await checkToolsWithSchema("native");
  await checkToolsWithSchema("simulated");
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
