// Tunables for indexing and the chat agent. Changing EMBED_MODEL or
// EMBED_DIMS requires reindexing every document (and updating the vector
// indexes in firestore.indexes.json).

export const REGION = "us-central1";

export const CHAT_MODEL = "gemini-3.5-flash";
export const CLASSIFY_MODEL = "gemini-3.5-flash";
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMS = 768;

// Chunking: target characters per chunk and overlap carried into the next.
export const CHUNK_CHARS = 1500;
export const CHUNK_OVERLAP = 200;
// Characters of a document shown to the classifier.
export const CLASSIFY_CHARS = 30_000;
// Hard cap on extracted text, so one huge upload can't exhaust the embedding
// quota (roughly 1,000 chunks).
export const MAX_DOC_CHARS = 1_500_000;
// Concurrent embedContent requests while indexing.
export const EMBED_CONCURRENCY = 8;

// Passages returned per searchDocuments call.
export const SEARCH_LIMIT = 6;
// Cosine distance above which a passage is treated as irrelevant.
export const MAX_DISTANCE = 0.65;
// Model turns per question, including tool calls.
export const MAX_TURNS = 6;
// Previous conversation turns (user + assistant pairs) sent as history.
export const HISTORY_TURNS = 6;
// Documents listed in the system prompt's catalog.
export const CATALOG_LIMIT = 100;

// "native": tools and the JSON answer schema in one Gemini request.
// "simulated": schema described in the prompt instead (fallback if a model
// rejects tools combined with a response schema).
export const ANSWER_MODE: "native" | "simulated" =
  process.env.ANSWER_MODE === "simulated" ? "simulated" : "native";

export const DISCLAIMER =
  "Is Legal gives guidance based on your organization's documents. It is " +
  "not legal advice. Contact Legal or Compliance before acting on anything " +
  "high-stakes.";
