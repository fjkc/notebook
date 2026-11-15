import "server-only";
import { generateText } from "ai";
import { toAiError } from "../ai/errors";
import { AI_MAX_RETRIES, getGemini } from "../ai/gemini";
import { SUMMARY_MODEL } from "../ai/models";
import { sourceSummaryPrompt } from "../ai/prompts";

/** A 3–4 sentence summary of a source's text. Gemini 429 → RATE_LIMITED, other failures → INTERNAL. */
export async function summarizeSource(text: string, signal?: AbortSignal): Promise<string> {
  try {
    const result = await generateText({
      model: getGemini()(SUMMARY_MODEL),
      prompt: sourceSummaryPrompt(text),
      maxRetries: AI_MAX_RETRIES,
      abortSignal: signal,
    });
    const summary = result.text.trim();
    if (!summary) throw new Error("Empty summary");
    return summary;
  } catch (error) {
    throw toAiError(error);
  }
}
