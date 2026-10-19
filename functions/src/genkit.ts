import {type EmbedderArgument, genkit, type ModelArgument} from "genkit";
import {googleAI, vertexAI} from "@genkit-ai/google-genai";
import {defineSecret} from "firebase-functions/params";
import {CHAT_MODEL, VERTEX_LOCATION} from "./config";

// Deployed functions call Gemini through Vertex AI, billed to the project and
// authorized by the functions' service account, so they need no API key. The
// emulators run as a demo- project, which can't reach Vertex AI, so they (and
// scripts run without a project) use the Gemini Developer API instead.
const project = process.env.GCLOUD_PROJECT;
export const USE_VERTEX = !!project && !project.startsWith("demo-");

// The googleAI plugin reads GOOGLE_GENAI_API_KEY lazily, at call time, so the
// secret only has to be bound to the functions that use Gemini. On the
// emulator it comes from functions/.secret.local.
const geminiKey = defineSecret("GOOGLE_GENAI_API_KEY");
export const geminiSecrets = USE_VERTEX ? [] : [geminiKey];

export const gemini = (name: string): ModelArgument =>
  USE_VERTEX ? vertexAI.model(name) : googleAI.model(name);
export const geminiEmbedder = (
  name: Parameters<typeof googleAI.embedder>[0]
): EmbedderArgument =>
  USE_VERTEX ? vertexAI.embedder(name) : googleAI.embedder(name);

export const ai = genkit({
  plugins: [USE_VERTEX ? vertexAI({location: VERTEX_LOCATION}) : googleAI()],
  model: gemini(CHAT_MODEL),
});
