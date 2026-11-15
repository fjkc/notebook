import { createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream, type ToolSet } from "ai";
import {
  AppError,
  ERROR_CODES,
  isEmptyAnswer,
  logOperation,
  saveAnswer,
  startChat,
  streamChatAnswer,
  toAiError,
  toErrorBody,
  type ErrorCode,
  type LogFields,
} from "@repo/backend";
import type { ChatUIMessage } from "@/lib/chat";
import { toLoggedErrorBody, withRoute } from "@/lib/http";
import { getOwnerId } from "@/lib/owner";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE = "chat";

/** The text a stream error shows: the mapped code's message (429 → RATE_LIMITED), never a raw error. */
function streamErrorText(error: unknown): string {
  return toErrorBody(toAiError(error)).body.error.message;
}

/**
 * Streams one grounded answer (NB-009 R9). Errors before streaming (validation, NOT_FOUND,
 * RATE_LIMITED, a 429 on the query embedding) throw and get the JSON error shape from withRoute.
 * From then on this route logs its one line itself, when the stream ends.
 */
export const POST = withRoute(
  ROUTE,
  async (request) => {
    const started = performance.now();
    const ownerId = await getOwnerId();
    const body: unknown = await request.json().catch(() => {
      throw new AppError("VALIDATION", "Send the question as JSON.");
    });
    const chat = await startChat(ownerId, body);

    let ended = false;
    /** Set on abort or a model error: nothing is saved and no finish or error part is added. */
    let failed = false;
    const log = (outcome: LogFields["outcome"], errorCode?: ErrorCode) => {
      if (ended) return;
      ended = true;
      logOperation({ route: ROUTE, ownerPrefix: ownerId, durationMs: performance.now() - started, outcome, errorCode });
    };

    const result = streamChatAnswer(chat, {
      abortSignal: request.signal,
      onEnd: async ({ text }) => {
        if (failed) return;
        if (isEmptyAnswer(text)) return log("empty");
        try {
          await saveAnswer(ownerId, chat.notebookId, text, chat.citations);
          log("ok");
        } catch (error) {
          // The answer stays on screen; it's missing after a reload (R9 "Failed save").
          toLoggedErrorBody(error, `${ROUTE}.saveAnswer`);
          log("error", "INTERNAL");
        }
      },
      onAbort: () => {
        failed = true;
        log("aborted");
      },
      onError: ({ error }) => {
        failed = true;
        log("error", toLoggedErrorBody(toAiError(error), ROUTE).body.error.code);
      },
    });

    const stream = createUIMessageStream<ChatUIMessage>({
      // Safety net for anything execute throws; same mapping as the model stream's.
      onError: streamErrorText,
      execute: async ({ writer }) => {
        const modelStream = toUIMessageStream<ToolSet, ChatUIMessage>({
          stream: result.stream,
          sendFinish: false,
          onError: streamErrorText,
          messageMetadata: ({ part }) => (part.type === "start" ? { citations: chat.citations } : undefined),
        });
        // Forwarded chunk by chunk (not writer.merge) so the finish or error part below is
        // guaranteed to come after the last text part.
        // After an abort the client is gone; a mid-stream error was already sent as an error part.
        // Either way (a rejected read or await, or a flag set by onAbort/onError) nothing more is written.
        let text: string;
        try {
          const reader = modelStream.getReader();
          for (let next = await reader.read(); !next.done; next = await reader.read()) writer.write(next.value);
          if (failed || request.signal.aborted || (await result.finishReason) === "error") return;
          text = await result.text;
        } catch {
          return;
        }
        if (isEmptyAnswer(text)) writer.write({ type: "error", errorText: ERROR_CODES.INTERNAL.message });
        else writer.write({ type: "finish" });
      },
    });

    return createUIMessageStreamResponse({ stream });
  },
  { streaming: true },
);
