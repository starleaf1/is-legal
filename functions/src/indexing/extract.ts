import {googleAI} from "@genkit-ai/google-genai";
import {logger} from "firebase-functions";
import {CLASSIFY_MODEL, MAX_DOC_CHARS} from "../config";
import {ai} from "../genkit";
import {withRetry} from "../shared/concurrency";

export interface ExtractedText {
  pages: string[];
  // True when pages are real PDF pages.
  paged: boolean;
  markdown: boolean;
  method: "text" | "pdf" | "gemini";
}

// Below this many characters per page, a PDF is probably scanned images.
const MIN_CHARS_PER_PAGE = 100;
// Gemini transcription is slower and costs output tokens; cap it.
const MAX_TRANSCRIBE_PAGES = 30;

export const normalizeContentType = (contentType: string, fileName: string) => {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (type && type !== "application/octet-stream") {
    return type === "text/x-markdown" ? "text/markdown" : type;
  }
  // Browsers often send no type for .md files.
  if (/\.(md|markdown)$/i.test(fileName)) return "text/markdown";
  if (/\.txt$/i.test(fileName)) return "text/plain";
  if (/\.pdf$/i.test(fileName)) return "application/pdf";
  return type;
};

const capPages = (pages: string[]) => {
  const capped: string[] = [];
  let total = 0;
  for (const page of pages) {
    if (total >= MAX_DOC_CHARS) break;
    capped.push(page.slice(0, MAX_DOC_CHARS - total));
    total += page.length;
  }
  return capped;
};

const transcribePdf = async (
  data: Buffer,
  totalPages: number
): Promise<ExtractedText> => {
  if (totalPages > MAX_TRANSCRIBE_PAGES) {
    throw new Error(
      `This PDF has no text layer and is too long (${totalPages} pages) ` +
      "to transcribe. Upload a text-based PDF."
    );
  }
  logger.info("PDF has no text layer; transcribing with Gemini", {totalPages});
  const {text} = await withRetry(() => ai.generate({
    model: googleAI.model(CLASSIFY_MODEL),
    prompt: [
      {
        media: {
          url: `data:application/pdf;base64,${data.toString("base64")}`,
          contentType: "application/pdf",
        },
      },
      {
        text: "Transcribe this document verbatim as Markdown. Keep headings, " +
          "numbering and tables. Do not summarize or omit anything. Before " +
          "each page's text, write a line `<!-- page N -->`. Output only the " +
          "transcription.",
      },
    ],
    config: {temperature: 0},
  }));
  const parts = text.split(/^<!--\s*page\s+\d+\s*-->\s*$/im)
    .map((part) => part.trim());
  const pages = parts[0] === "" ? parts.slice(1) : parts;
  return {
    pages: capPages(pages),
    paged: pages.length > 1,
    markdown: true,
    method: "gemini",
  };
};

const extractPdf = async (data: Buffer): Promise<ExtractedText> => {
  // unpdf is ESM-only; a dynamic import works from the CommonJS build.
  const {extractText, getDocumentProxy} = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const {totalPages, text} = await extractText(pdf, {mergePages: false});
  const chars = text.reduce((sum, page) => sum + page.trim().length, 0);
  if (chars / Math.max(totalPages, 1) < MIN_CHARS_PER_PAGE) {
    return transcribePdf(data, totalPages);
  }
  return {pages: capPages(text), paged: true, markdown: false, method: "pdf"};
};

/**
 * Extracts a document's text, per page for PDFs.
 * @param {Buffer} data File contents.
 * @param {string} contentType The object's content type.
 * @param {string} fileName The object's file name.
 * @return {Promise<ExtractedText>} The text and how it was obtained.
 */
export const extractText = async (
  data: Buffer,
  contentType: string,
  fileName: string
): Promise<ExtractedText> => {
  const type = normalizeContentType(contentType, fileName);
  if (type === "application/pdf") return extractPdf(data);
  if (type === "text/plain" || type === "text/markdown") {
    return {
      pages: [data.toString("utf8").slice(0, MAX_DOC_CHARS)],
      paged: false,
      markdown: type === "text/markdown",
      method: "text",
    };
  }
  throw new Error(`Unsupported file type: ${contentType || fileName}`);
};
