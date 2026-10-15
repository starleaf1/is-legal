import type {Query} from "firebase-admin/firestore";
import {logger} from "firebase-functions";
import {MAX_DISTANCE, SEARCH_LIMIT} from "../config";
import {embedQuery} from "../indexing/embed";
import {chunksCol} from "../shared/paths";
import type {Category, Scope} from "../shared/schemas";

export interface SearchHit {
  chunkId: string;
  documentId: string;
  title: string;
  category: Category;
  scope: Scope;
  jurisdiction: string | null;
  effectiveDate: string | null;
  heading: string | null;
  page: number | null;
  text: string;
  distance: number;
}

export interface SearchOptions {
  scope?: Scope;
  documentId?: string;
  limit?: number;
}

/**
 * Finds the passages in one org's documents nearest to a query. Always
 * queries orgs/{orgId}/chunks (never a collection group), so results can't
 * come from another tenant.
 * @param {string} orgId The caller's org, from their verified claims.
 * @param {string} query Natural-language search text.
 * @param {SearchOptions} options Optional scope or document filter.
 * @return {Promise<SearchHit[]>} Passages, nearest first.
 */
export const vectorSearch = async (
  orgId: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchHit[]> => {
  const queryVector = await embedQuery(query);
  let base: Query = chunksCol(orgId);
  // One equality prefilter at a time; each has its own vector index.
  if (options.documentId) {
    base = base.where("documentId", "==", options.documentId);
  } else if (options.scope) {
    base = base.where("scope", "==", options.scope);
  }
  const snapshot = await base.findNearest({
    vectorField: "embedding",
    queryVector,
    limit: options.limit ?? SEARCH_LIMIT,
    distanceMeasure: "COSINE",
    distanceResultField: "distance",
  }).get();

  const hits = snapshot.docs
    .filter((doc) => doc.ref.parent.parent?.id === orgId)
    .map((doc): SearchHit => ({
      chunkId: doc.id,
      documentId: doc.get("documentId"),
      title: doc.get("title"),
      category: doc.get("category"),
      scope: doc.get("scope"),
      jurisdiction: doc.get("jurisdiction") ?? null,
      effectiveDate: doc.get("effectiveDate") ?? null,
      heading: doc.get("heading") ?? null,
      page: doc.get("page") ?? null,
      text: doc.get("text"),
      distance: doc.get("distance"),
    }));
  const relevant = hits.filter((hit) => hit.distance <= MAX_DISTANCE);
  logger.debug("vectorSearch", {
    orgId,
    query,
    scope: options.scope,
    documentId: options.documentId,
    distances: hits.map((hit) => Number(hit.distance.toFixed(3))),
    kept: relevant.length,
  });
  return relevant;
};
