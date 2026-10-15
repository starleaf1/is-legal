import {genkit} from "genkit";
import {googleAI} from "@genkit-ai/google-genai";
import {defineSecret} from "firebase-functions/params";
import {CHAT_MODEL} from "./config";

// The googleAI plugin reads GOOGLE_GENAI_API_KEY lazily, at call time, so the
// secret only has to be bound to the functions that use Gemini. On the
// emulator it comes from functions/.secret.local.
export const geminiKey = defineSecret("GOOGLE_GENAI_API_KEY");

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(CHAT_MODEL),
});
