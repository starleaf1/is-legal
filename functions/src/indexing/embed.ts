import {googleAI} from "@genkit-ai/google-genai";
import {EMBED_CONCURRENCY, EMBED_DIMS, EMBED_MODEL} from "../config";
import {ai} from "../genkit";
import {mapWithConcurrency, withRetry} from "../shared/concurrency";

// Options are passed on every call: ai.embedMany ignores config attached to
// the embedder reference, and the default 3072 dimensions exceed Firestore's
// 2048 vector limit.
const embedder = googleAI.embedder(EMBED_MODEL);

const embedOne = async (
  text: string,
  options: Record<string, unknown>
): Promise<number[]> => {
  const [result] = await withRetry(() => ai.embed({
    embedder,
    content: text,
    options: {outputDimensionality: EMBED_DIMS, ...options},
  }));
  if (result?.embedding?.length !== EMBED_DIMS) {
    throw new Error(
      `Expected a ${EMBED_DIMS}-dimension embedding, got ` +
      `${result?.embedding?.length ?? "none"}.`
    );
  }
  return result.embedding;
};

/**
 * Embeds document passages for storage.
 * @param {string[]} texts Passages to embed.
 * @param {string} title The document title (improves document embeddings).
 * @return {Promise<Array<Array<number>>>} One vector per passage.
 */
export const embedPassages = (texts: string[], title: string) =>
  mapWithConcurrency(texts, EMBED_CONCURRENCY, (text) =>
    embedOne(text, {taskType: "RETRIEVAL_DOCUMENT", title}));

/**
 * Embeds a search query.
 * @param {string} query The query text.
 * @return {Promise<number[]>} The query vector.
 */
export const embedQuery = (query: string) =>
  embedOne(query, {taskType: "RETRIEVAL_QUERY"});
