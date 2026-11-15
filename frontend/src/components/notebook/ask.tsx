"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { chatErrorMessage, messageText, type ChatUIMessage } from "@/lib/chat";
import { AskInput } from "./ask-input";
import { ClearChatDialog } from "./clear-chat-dialog";
import { MessageList } from "./message-list";
import { useNotebookState, useSourceSelection } from "./notebook-state";
import { SuggestedQuestions } from "./suggested-questions";

const NO_SOURCE_REASON = "Add a source first";
const NONE_PICKED_REASON = "Pick at least one source to ask about.";

type AskProps = {
  notebookId: string;
  /** The stored conversation, loaded on the server (NB-009 R12). */
  initialMessages: ChatUIMessage[];
  /** Loading the stored conversation failed; only shown while the chat is empty. */
  historyFailed: boolean;
  /** The notebook's stored suggested questions (NB-010 R6); the refresh after processing updates them. */
  suggestedQuestions: readonly string[];
};

/**
 * Ask (DESIGN.md → "Layout"): the chat area. The request carries only the new question and, when
 * some ready sources are excluded, the included ones; the server builds the history (NB-009 R8).
 */
export function Ask({ notebookId, initialMessages, historyFailed, suggestedQuestions }: AskProps) {
  const { clearCitation } = useNotebookState();
  const { readyCount, includedCount, sourceIds } = useSourceSelection();
  const hasReadySource = readyCount > 0;
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        // `body` is the per-request options' body: only its sourceIds is forwarded (the route is strict).
        prepareSendMessagesRequest: ({ messages, body }) => {
          const question = messages.findLast((message) => message.role === "user");
          const selected: unknown = body?.sourceIds;
          return {
            body: {
              notebookId,
              text: question ? messageText(question) : "",
              ...(Array.isArray(selected) ? { sourceIds: selected } : {}),
            },
          };
        },
      }),
  );
  const [clearing, setClearing] = useState(false);
  const { messages, sendMessage, regenerate, stop, status, error, setMessages } = useChat<ChatUIMessage>({
    id: notebookId,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  // useChat reads initialMessages only once, so a later successful refresh doesn't fill the chat:
  // keep the first load's failure until the user reloads, as the line asks.
  const [historyMissing] = useState(historyFailed);

  // An answer that failed before any text (e.g. an empty answer) leaves no empty bubble behind.
  useEffect(() => {
    if (status !== "error") return;
    setMessages((current) => {
      const last = current.at(-1);
      return last?.role === "assistant" && !messageText(last).trim() ? current.slice(0, -1) : current;
    });
  }, [status, setMessages]);

  const disabledReason = !hasReadySource ? NO_SOURCE_REASON : includedCount === 0 ? NONE_PICKED_REASON : null;
  // The current selection goes with each request, a retry included (R7).
  const requestOptions = { body: sourceIds ? { sourceIds } : {} };
  const send = (text: string) => void sendMessage({ text }, requestOptions);

  const lastIsAnswerWithText = messages.at(-1)?.role === "assistant" && messageText(messages.at(-1)!).length > 0;

  return (
    <section aria-labelledby="ask-heading" className="flex min-h-0 min-w-0 flex-1 flex-col lg:basis-3/5">
      <div className="flex h-12 items-center justify-between gap-2 px-4 pt-2 sm:px-6">
        <h2 id="ask-heading" className="text-sm font-medium">
          Ask
        </h2>
        {messages.length > 0 && !busy && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setClearing(true)}>
            Clear chat
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-xl">
            <h3 className="font-reading text-[1.375rem] leading-snug font-medium">Ask about your sources</h3>
            <p className="mt-2 text-graphite">
              {hasReadySource
                ? "Answers come only from your sources, with a numbered hook to each passage."
                : "Add a source first. Answers come only from your sources, with a hook to each passage."}
            </p>
            {hasReadySource && (
              <SuggestedQuestions
                questions={suggestedQuestions}
                disabledReason={includedCount === 0 ? NONE_PICKED_REASON : null}
                onPick={send}
              />
            )}
            {historyMissing && (
              <p role="alert" className="mt-4 text-sm text-danger">
                Couldn&apos;t load the earlier conversation. Reload the page to try again.
              </p>
            )}
          </div>
        </div>
      ) : (
        <MessageList
          messages={messages}
          waiting={busy && !lastIsAnswerWithText}
          error={status === "error" && error ? chatErrorMessage(error) : null}
          // With every source excluded a retry would send sourceIds: []; the line above the input says why.
          onRetry={includedCount > 0 ? () => void regenerate(requestOptions) : null}
        />
      )}

      <div className="px-4 pb-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {hasReadySource && includedCount < readyCount && (
            <p className="mb-2 text-sm text-graphite">
              {includedCount === 0
                ? NONE_PICKED_REASON
                : `Answering from ${includedCount} of ${readyCount} ${readyCount === 1 ? "source" : "sources"}`}
            </p>
          )}
          <AskInput disabledReason={disabledReason} busy={busy} onSend={send} onStop={() => void stop()} />
        </div>
      </div>

      <ClearChatDialog
        notebookId={notebookId}
        open={clearing}
        onOpenChange={setClearing}
        onCleared={() => {
          setMessages([]);
          clearCitation();
        }}
      />
    </section>
  );
}
