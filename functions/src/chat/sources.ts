import type {Answer, Citation} from "../shared/schemas";
import type {SearchHit} from "./retrieval";

const MARKER = /\s?\[(\d+(?:\s*,\s*\d+)*)\]/g;

/**
 * Numbers the passages the agent sees across all its searches in one turn,
 * so the model can cite them as [n] and the server can map each [n] back to
 * a document. Refs are stable within a turn and de-duplicated by chunk.
 */
export class SourceRegistry {
  private readonly hits = new Map<number, SearchHit>();
  private readonly refsByChunk = new Map<string, number>();

  /**
   * Registers a passage.
   * @param {SearchHit} hit The passage.
   * @return {number} Its ref number.
   */
  add(hit: SearchHit): number {
    const existing = this.refsByChunk.get(hit.chunkId);
    if (existing) return existing;
    const ref = this.hits.size + 1;
    this.hits.set(ref, hit);
    this.refsByChunk.set(hit.chunkId, ref);
    return ref;
  }

  /**
   * Builds citations for every ref the answer uses, and strips refs the
   * agent never saw (so a hallucinated [n] can't point anywhere).
   * @param {Answer} answer The model's answer.
   * @return {object} The cleaned answer and its citations, ordered by ref.
   */
  resolve(answer: Answer): {answer: Answer; citations: Citation[]} {
    const used = new Set<number>();
    const clean = (text: string) =>
      text.replace(MARKER, (match, list: string) => {
        const known = list.split(",")
          .map((n) => Number(n.trim()))
          .filter((ref) => this.hits.has(ref));
        known.forEach((ref) => used.add(ref));
        if (!known.length) return "";
        const space = match.startsWith(" ") ? " " : "";
        return `${space}[${known.join(", ")}]`;
      });

    const cleaned: Answer = {
      ...answer,
      summary: clean(answer.summary),
      dimensions: answer.dimensions.map((d) => ({...d, note: clean(d.note)})),
      analysis: clean(answer.analysis),
      conditions: answer.conditions.map(clean),
      citedSources: [],
    };
    answer.citedSources
      .filter((ref) => this.hits.has(ref))
      .forEach((ref) => used.add(ref));
    cleaned.citedSources = [...used].sort((a, b) => a - b);

    const citations = cleaned.citedSources.map((ref): Citation => {
      const hit = this.hits.get(ref) as SearchHit;
      return {
        ref,
        documentId: hit.documentId,
        chunkId: hit.chunkId,
        title: hit.title,
        category: hit.category,
        heading: hit.heading,
        page: hit.page,
        excerpt: hit.text,
      };
    });
    return {answer: cleaned, citations};
  }
}
