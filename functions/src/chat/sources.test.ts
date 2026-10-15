import {describe, it} from "node:test";
import assert from "node:assert/strict";
import type {Answer} from "../shared/schemas";
import type {SearchHit} from "./retrieval";
import {SourceRegistry} from "./sources";

const hit = (chunkId: string, documentId = "doc1"): SearchHit => ({
  chunkId,
  documentId,
  title: `Title of ${documentId}`,
  category: "company_policy",
  scope: "policy",
  jurisdiction: null,
  effectiveDate: null,
  heading: "3. Gifts",
  page: null,
  text: `Text of ${chunkId}`,
  distance: 0.2,
});

const answer = (overrides: Partial<Answer> = {}): Answer => ({
  verdict: "prohibited",
  confidence: "high",
  summary: "No [1].",
  dimensions: [],
  analysis: "",
  conditions: [],
  escalation: {recommended: false, contact: null, reason: null},
  followUpQuestions: [],
  citedSources: [],
  ...overrides,
});

describe("SourceRegistry", () => {
  it("numbers passages and de-duplicates by chunk", () => {
    const registry = new SourceRegistry();
    assert.equal(registry.add(hit("a")), 1);
    assert.equal(registry.add(hit("b")), 2);
    assert.equal(registry.add(hit("a")), 1);
  });

  it("collects refs from text and citedSources, dropping unknown ones", () => {
    const registry = new SourceRegistry();
    registry.add(hit("a", "doc1"));
    registry.add(hit("b", "doc2"));
    registry.add(hit("c", "doc3"));
    const {answer: cleaned, citations} = registry.resolve(answer({
      summary: "Not allowed [2].",
      analysis: "Policy says no [1, 9]. Made up [7]. Also [3]",
      conditions: ["Ask Compliance [9]"],
      citedSources: [3, 8],
    }));
    assert.equal(cleaned.analysis, "Policy says no [1]. Made up. Also [3]");
    assert.deepEqual(cleaned.conditions, ["Ask Compliance"]);
    assert.deepEqual(cleaned.citedSources, [1, 2, 3]);
    assert.deepEqual(citations.map((c) => c.documentId),
      ["doc1", "doc2", "doc3"]);
    assert.equal(citations[0].excerpt, "Text of a");
  });

  it("returns no citations when nothing was searched", () => {
    const registry = new SourceRegistry();
    const {answer: cleaned, citations} = registry.resolve(answer());
    assert.equal(cleaned.summary, "No.");
    assert.deepEqual(citations, []);
  });
});
