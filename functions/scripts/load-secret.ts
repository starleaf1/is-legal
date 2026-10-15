import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";

/**
 * Loads GOOGLE_GENAI_API_KEY from functions/.secret.local (the file the
 * functions emulator reads) when it isn't already in the environment.
 */
export const loadGeminiKey = () => {
  if (process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY) return;
  const file = join(__dirname, "..", ".secret.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*GOOGLE_GENAI_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (match) {
      process.env.GOOGLE_GENAI_API_KEY = match[1].replace(/^["']|["']$/g, "");
    }
  }
};
