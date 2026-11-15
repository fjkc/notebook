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
 * timeout (or the caller's earlier deadline), because it runs inside the process route after markReady. Gemini 429 → RATE_LIMITED,
 * other failures → INTERNAL; the caller logs and swallows both.
 */
export async function generateSuggestedQuestions(summaries: string[], signal?: AbortSignal): Promise<string[]> {
  const timeout = AbortSignal.timeout(SUGGESTIONS_TIMEOUT_MS);
  try {
    const { output } = await generateText({
      model: getGemini()(SUMMARY_MODEL),
      prompt: suggestedQuestionsPrompt(summaries),
      output: Output.object({ schema: SuggestedQuestions }),
      maxRetries: 0,
      abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return cleanSuggestedQuestions(output.questions);
  } catch (error) {
    throw toAiError(error);
  }
}
