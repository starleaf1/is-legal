import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {chunkText, overlapTail, splitLong} from "./chunk";

const words = (n: number, word = "lorem") =>
  Array.from({length: n}, () => word).join(" ") + ".";

describe("chunkText", () => {
  it("tracks markdown heading paths; a leading H1 is the title", () => {
    const md = [
      "# Gifts Policy",
      "",
      "Intro paragraph.",
      "",
      "## 3. Gifts",
      "",
      "Gifts up to USD 50 are fine.",
      "",
      "### 3.1 Government officials",
      "",
      "Never give anything to officials.",
    ].join("\n");
    const chunks = chunkText([md], {markdown: true, maxChars: 80});
    const headings = chunks.map((c) => c.heading);
    assert.deepEqual(headings, [
      null,
      "3. Gifts",
      "3. Gifts › 3.1 Government officials",
    ]);
    assert.match(chunks[2].text, /Never give anything/);
    assert.ok(chunks.every((c) => c.page === null));
  });

  it("does not treat numbered list items as headings in markdown", () => {
    const md = "## Rules\n\n1. Never accept cash\n2. Log every gift";
    const chunks = chunkText([md], {markdown: true});
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].heading, "Rules");
  });

  it("detects legal divisions and numbered headings in plain text", () => {
    const text = [
      "Article 4 Facilitation payments",
      "No person shall make a facilitation payment.",
      "",
      "4.1 Exceptions",
      "Payments under duress are not offences.",
    ].join("\n");
    const chunks = chunkText([text], {maxChars: 60});
    assert.equal(chunks[0].heading, "Article 4 Facilitation payments");
    assert.equal(
      chunks[chunks.length - 1].heading,
      "Article 4 Facilitation payments › 4.1 Exceptions"
    );
  });

  it("numbers pages when paged", () => {
    const chunks = chunkText(
      [words(150, "alpha"), words(150, "beta")],
      {paged: true, maxChars: 800}
    );
    assert.equal(chunks[0].page, 1);
    assert.equal(chunks[chunks.length - 1].page, 2);
    assert.ok(chunks.length >= 2);
  });

  it("keeps chunks within maxChars plus overlap and indexes them", () => {
    const paragraphs = Array.from({length: 20}, (_, i) =>
      `Paragraph ${i}. ${words(40)}`);
    const chunks = chunkText([paragraphs.join("\n\n")], {
      maxChars: 600,
      overlap: 100,
    });
    assert.ok(chunks.length > 3);
    chunks.forEach((chunk, i) => {
      assert.equal(chunk.index, i);
      assert.ok(chunk.text.length <= 600 + 100 + 2, `chunk ${i} too long`);
    });
  });

  it("carries overlap between chunks of the same section", () => {
    const text = `${words(60, "first")}\n\nSecond sentence ends here. ` +
      `${words(60, "third")}`;
    const chunks = chunkText([text], {maxChars: 400, overlap: 120});
    assert.ok(chunks.length >= 2);
    const tail = chunks[0].text.slice(-40);
    assert.ok(chunks[1].text.includes(tail.trim().split(" ").pop()!));
  });

  it("returns nothing for empty input", () => {
    assert.deepEqual(chunkText(["", "  \n\n "]), []);
  });
});

describe("splitLong", () => {
  it("splits at sentence ends", () => {
    const pieces = splitLong("One two. Three four. Five six.", 12);
    assert.deepEqual(pieces, ["One two.", "Three four.", "Five six."]);
  });

  it("hard-splits a very long sentence", () => {
    const pieces = splitLong(words(100), 100);
    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((p) => p.length <= 100));
  });
});

describe("overlapTail", () => {
  it("starts at a sentence boundary when there is one", () => {
    const tail = overlapTail(
      "A long first sentence here. Second sentence is the tail one.",
      45
    );
    assert.equal(tail, "Second sentence is the tail one.");
  });

  it("returns nothing when overlap is disabled", () => {
    assert.equal(overlapTail("Some text.", 0), "");
  });
});
