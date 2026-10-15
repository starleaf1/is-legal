import {z} from "genkit";

// Shared shapes for indexing, the chat flow and (mirrored by hand) the web
// client in src/interfaces/. Keep the two in sync.

export const CATEGORIES = [
  "code_of_conduct",
  "company_policy",
  "guidance",
  "law",
  "regulation",
  "case_record",
  "other",
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

// Coarse grouping used to prefilter vector search, so the agent can look up
// internal policy and law separately.
export const SCOPES = ["policy", "law", "precedent", "other"] as const;
export const ScopeSchema = z.enum(SCOPES);
export type Scope = z.infer<typeof ScopeSchema>;

export const CATEGORY_TO_SCOPE: Record<Category, Scope> = {
  code_of_conduct: "policy",
  company_policy: "policy",
  guidance: "policy",
  law: "law",
  regulation: "law",
  case_record: "precedent",
  other: "other",
};

export const ClassificationSchema = z.object({
  title: z.string().describe("Formal title of the document"),
  category: CategorySchema.describe(
    "code_of_conduct: the organization's code of conduct or ethics. " +
    "company_policy: an internal policy or procedure. " +
    "guidance: internal FAQs, playbooks or training material. " +
    "law: a statute or act passed by a legislature. " +
    "regulation: rules issued by a government agency or regulator. " +
    "case_record: a record of a past dispute, investigation or ruling. " +
    "other: anything else."
  ),
  jurisdiction: z.string().nullable().describe(
    "Country, state or region the document governs (for laws) or applies " +
    "in (for policies), e.g. \"Northland\". null if it applies everywhere " +
    "or isn't stated."
  ),
  issuingBody: z.string().nullable().describe(
    "Who issued the document, e.g. a legislature, regulator, the company's " +
    "Compliance team. null if unknown."
  ),
  effectiveDate: z.string().nullable().describe(
    "Date the document took effect, as YYYY-MM-DD, if stated. Otherwise null."
  ),
  topics: z.array(z.string()).max(8).describe(
    "Short lowercase topics, e.g. \"gifts\", \"bribery\", \"personal data\""
  ),
  summary: z.string().describe(
    "2-3 sentences on what the document covers and who it applies to"
  ),
  language: z.string().describe("BCP-47 language code, e.g. \"en\""),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const VERDICTS = [
  "permitted",
  "permitted_with_conditions",
  "prohibited",
  "needs_more_info",
  "unclear",
  "not_applicable",
] as const;
export const VerdictSchema = z.enum(VERDICTS);

// Field order matters: the client renders the answer while it streams, so the
// verdict and summary come first.
export const AnswerSchema = z.object({
  verdict: VerdictSchema.describe(
    "Overall verdict; the most restrictive of the dimension verdicts"
  ),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string().describe(
    "Direct 1-2 sentence answer to the employee's question"
  ),
  dimensions: z.array(z.object({
    source: z.enum(["law", "company_policy", "precedent"]),
    verdict: VerdictSchema,
    note: z.string().describe("One sentence, citing passages as [n]"),
  })).describe(
    "Separate findings for law, company policy and past cases. Include only " +
    "the sources you found relevant passages for."
  ),
  analysis: z.string().describe(
    "Markdown reasoning. Cite passages inline as [n], using only ref numbers " +
    "returned by searchDocuments."
  ),
  conditions: z.array(z.string()).describe(
    "Approvals, limits or steps required before proceeding. Empty if none."
  ),
  escalation: z.object({
    recommended: z.boolean(),
    contact: z.string().nullable().describe(
      "Who to contact, e.g. Compliance, Legal, HR, Data Protection Officer"
    ),
    reason: z.string().nullable(),
  }),
  followUpQuestions: z.array(z.string()).max(3).describe(
    "Questions whose answers would change or firm up the verdict"
  ),
  citedSources: z.array(z.number().int()).describe(
    "Every [n] ref used in this answer"
  ),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const CitationSchema = z.object({
  ref: z.number().int(),
  documentId: z.string(),
  chunkId: z.string(),
  title: z.string(),
  category: CategorySchema,
  heading: z.string().nullable(),
  page: z.number().int().nullable(),
  excerpt: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const SearchRecordSchema = z.object({
  query: z.string(),
  scope: ScopeSchema.nullable(),
  documentId: z.string().nullable(),
  resultCount: z.number().int(),
});
export type SearchRecord = z.infer<typeof SearchRecordSchema>;

export const AskInputSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
});

export const AskChunkSchema = z.union([
  z.object({type: z.literal("meta"), conversationId: z.string()}),
  z.object({
    type: z.literal("search"),
    query: z.string(),
    scope: ScopeSchema.nullable(),
    results: z.array(z.object({ref: z.number().int(), title: z.string()})),
  }),
  z.object({
    type: z.literal("answer"),
    partial: z.record(z.string(), z.unknown()).describe(
      "The answer parsed so far; fields fill in as the model writes them"
    ),
  }),
]);
export type AskChunk = z.infer<typeof AskChunkSchema>;

export const AskResultSchema = z.object({
  conversationId: z.string(),
  messageId: z.string(),
  answer: AnswerSchema,
  citations: z.array(CitationSchema),
  disclaimer: z.string(),
});
export type AskResult = z.infer<typeof AskResultSchema>;
