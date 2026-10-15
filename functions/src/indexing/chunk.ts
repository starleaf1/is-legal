// Heading-aware splitter. Pure (no I/O) so it can be unit tested.
//
// Text is split into paragraphs, each tagged with the heading path it falls
// under (e.g. "4. Gifts › 4.2 Government officials") and its page. Paragraphs
// are then packed into chunks of about maxChars. A new section starts a new
// chunk, and a chunk split mid-section carries the tail of the previous one
// so a sentence near the boundary is retrievable from either side.

export interface TextChunk {
  index: number;
  heading: string | null;
  page: number | null;
  text: string;
}

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
  // Pages are real pages (PDF); otherwise page numbers are null.
  paged?: boolean;
  // Only markdown "#" headings and legal divisions count as headings, so
  // numbered list items aren't mistaken for section titles.
  markdown?: boolean;
}

interface Block {
  text: string;
  heading: string | null;
  page: number | null;
}

interface Heading {
  level: number;
  text: string;
}

const MD_HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const DIVISION = /^(part|chapter|title|bab)\s+[\dIVXLC]+\b/i;
const ARTICLE = /^(article|section|clause|pasal|§)\s*\d+[A-Za-z]?\b/i;
const NUMBERED = /^(\d+(?:\.\d+)*)\.?\s+(\S.*)$/;

const clean = (text: string) => text.replace(/\*\*|__/g, "").trim();

const detectHeading = (line: string, markdown: boolean): Heading | null => {
  if (line.length > 120) return null;
  const md = MD_HEADING.exec(line);
  if (md) return {level: md[1].length, text: clean(md[2])};
  if (DIVISION.test(line)) return {level: 1, text: clean(line)};
  if (ARTICLE.test(line)) return {level: 2, text: clean(line)};
  if (markdown) return null;
  const numbered = NUMBERED.exec(line);
  if (
    numbered &&
    line.length <= 80 &&
    /^[A-Z]/.test(numbered[2]) &&
    !/[.:;,]$/.test(line)
  ) {
    return {level: 2 + numbered[1].split(".").length, text: clean(line)};
  }
  return null;
};

/**
 * Splits text longer than maxChars at sentence ends, falling back to word
 * boundaries for very long sentences.
 * @param {string} text The paragraph.
 * @param {number} maxChars Maximum piece length.
 * @return {string[]} Pieces no longer than maxChars.
 */
export const splitLong = (text: string, maxChars: number): string[] => {
  if (text.length <= maxChars) return [text];
  const sentences = text.split(/(?<=[.!?;:])\s+|\n+/).filter(Boolean);
  const pieces: string[] = [];
  let current = "";
  const push = (piece: string) => {
    if (piece.trim()) pieces.push(piece.trim());
  };
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      push(current);
      current = "";
      let rest = sentence;
      while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(" ", maxChars);
        const at = cut > maxChars / 2 ? cut : maxChars;
        push(rest.slice(0, at));
        rest = rest.slice(at);
      }
      current = rest;
    } else if (current.length + 1 + sentence.length > maxChars) {
      push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  push(current);
  return pieces;
};

/**
 * Returns roughly the last `overlap` characters of text, starting at a
 * sentence or word boundary.
 * @param {string} text The previous chunk.
 * @param {number} overlap Target length.
 * @return {string} The tail to repeat at the start of the next chunk.
 */
export const overlapTail = (text: string, overlap: number): string => {
  if (overlap <= 0 || text.length <= overlap) return "";
  const tail = text.slice(-overlap);
  const sentenceEnd = tail.search(/[.!?]\s+\S/);
  // Prefer a sentence boundary unless it leaves only a sliver of text.
  if (sentenceEnd >= 0 && tail.length - sentenceEnd >= overlap / 4) {
    return tail.slice(sentenceEnd + 1).trim();
  }
  const space = tail.indexOf(" ");
  return (space >= 0 ? tail.slice(space + 1) : tail).trim();
};

const toBlocks = (
  pages: string[],
  {paged, markdown, maxChars}: {
    paged: boolean;
    markdown: boolean;
    maxChars: number;
  }
): Block[] => {
  const blocks: Block[] = [];
  const stack: Heading[] = [];
  let seenHeading = false;
  const headingPath = () =>
    stack.length ? stack.map((h) => h.text).join(" › ") : null;

  pages.forEach((pageText, i) => {
    const page = paged ? i + 1 : null;
    let paragraph: string[] = [];
    const flush = () => {
      const text = paragraph.join("\n").trim();
      paragraph = [];
      if (!text) return;
      for (const piece of splitLong(text, maxChars)) {
        blocks.push({text: piece, heading: headingPath(), page});
      }
    };

    for (const raw of pageText.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        flush();
        continue;
      }
      const heading = detectHeading(line, markdown);
      if (!heading) {
        paragraph.push(raw.trimEnd());
        continue;
      }
      flush();
      // A leading level-1 heading is the document's title, not a section.
      const isTitle = !seenHeading && heading.level === 1 && !blocks.length;
      seenHeading = true;
      if (!isTitle) {
        while (stack.length && stack[stack.length - 1].level >= heading.level) {
          stack.pop();
        }
        stack.push(heading);
      }
      blocks.push({text: line, heading: headingPath(), page});
    }
    flush();
  });
  return blocks;
};

/**
 * Splits a document into retrieval chunks.
 * @param {string[]} pages Document text, one entry per page (or one entry for
 *   unpaged text).
 * @param {ChunkOptions} options Sizes and parsing hints.
 * @return {TextChunk[]} Chunks in document order.
 */
export const chunkText = (
  pages: string[],
  options: ChunkOptions = {}
): TextChunk[] => {
  const maxChars = options.maxChars ?? 1500;
  const overlap = options.overlap ?? 200;
  const blocks = toBlocks(pages, {
    paged: options.paged ?? false,
    markdown: options.markdown ?? false,
    maxChars,
  });

  const chunks: TextChunk[] = [];
  let current: Block | null = null;
  const flush = () => {
    if (current && current.text.trim()) {
      chunks.push({
        index: chunks.length,
        heading: current.heading,
        page: current.page,
        text: current.text.trim(),
      });
    }
    current = null;
  };

  for (const block of blocks) {
    if (!current) {
      current = {...block};
      continue;
    }
    const sameSection: boolean = block.heading === current.heading;
    // Start each section in a fresh chunk unless the current one is tiny.
    if (!sameSection && current.text.length >= maxChars * 0.3) {
      flush();
      current = {...block};
      continue;
    }
    if (current.text.length + 2 + block.text.length <= maxChars) {
      current.text += `\n\n${block.text}`;
      continue;
    }
    const tail: string = sameSection ?
      overlapTail(current.text, overlap) :
      "";
    flush();
    current = {...block, text: tail ? `${tail}\n\n${block.text}` : block.text};
  }
  flush();
  return chunks;
};
