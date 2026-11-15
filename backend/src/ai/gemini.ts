import "server-only";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import { getGeminiEnv } from "../env";

let provider: GoogleGenerativeAIProvider | undefined;

/** Gemini provider with the server key, created on first use (the key is never read at import). */
export function getGemini(): GoogleGenerativeAIProvider {
  provider ??= createGoogleGenerativeAI({ apiKey: getGeminiEnv().GOOGLE_GENERATIVE_AI_API_KEY });
  return provider;
}

/** Retries per AI SDK call for short bursts (docs/ARCHITECTURE.md §11). */
export const AI_MAX_RETRIES = 2;
