import "server-only";
import { streamText } from "ai";
import type { StartedChat } from "../services/chat";
import { AI_MAX_RETRIES, getGemini } from "./gemini";
import { TEXT_MODEL } from "./models";

type StreamCallbacks = Pick<Parameters<typeof streamText>[0], "abortSignal" | "onEnd" | "onAbort" | "onError">;

/** Low temperature: answers should stick to the passages. */
const CHAT_TEMPERATURE = 0.2;

/**
 * Streams the answer for a prepared chat turn (NB-009 R9). The history is text only; the question
 * goes last. The route turns the result into a UI message stream and handles saving and logging.
 */
export function streamChatAnswer(chat: StartedChat, callbacks: StreamCallbacks) {
  return streamText({
    model: getGemini()(TEXT_MODEL),
    instructions: chat.system,
    messages: [...chat.history, { role: "user", content: chat.question }],
    temperature: CHAT_TEMPERATURE,
    maxRetries: AI_MAX_RETRIES,
    ...callbacks,
  });
}
