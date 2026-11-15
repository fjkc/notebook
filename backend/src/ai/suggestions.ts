import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { SUGGESTIONS_TIMEOUT_MS } from "../shared/limits";
import { toAiError } from "./errors";
import { getGemini } from "./gemini";
import { SUMMARY_MODEL } from "./models";
import { cleanSuggestedQuestions, suggestedQuestionsPrompt } from "./prompts";

const SuggestedQuestions = z.object({ questions: z.array(z.string()) });

/**
 * 0–5 cleaned suggested questions from source summaries (NB-010 R5). No retries and its own 10 s
 * timeout, because it runs inside the process route after markReady. Gemini 429 → RATE_LIMITED,
 * other failures → INTERNAL; the caller logs and swallows both.
 */
export async function generateSuggestedQuestions(summaries: string[]): Promise<string[]> {
  try {
    const { output } = await generateText({
      model: getGemini()(SUMMARY_MODEL),
      prompt: suggestedQuestionsPrompt(summaries),
      output: Output.object({ schema: SuggestedQuestions }),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(SUGGESTIONS_TIMEOUT_MS),
    });
    return cleanSuggestedQuestions(output.questions);
  } catch (error) {
    throw toAiError(error);
  }
}
