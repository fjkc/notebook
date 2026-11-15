"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { chatErrorMessage, type ChatUIMessage } from "@/lib/chat";
import { AskInput } from "./ask-input";
import { MessageList, messageText } from "./message-list";
import { ReaderContent } from "./reader";

type AskProps = {
  notebookId: string;
  /** The stored conversation, loaded on the server (NB-009 R12). */
  initialMessages: ChatUIMessage[];
  /** At least one ready source; the Shelf's polling refresh updates it. */
  hasReadySource: boolean;
};

/**
 * Ask (DESIGN.md → "Layout"): the chat area. Between 640 and 1023 px its header opens the Reader
 * as a sheet. The request carries only the new question; the server builds the history (R8).
 */
export function Ask({ notebookId, initialMessages, hasReadySource }: AskProps) {
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          const question = messages.findLast((message) => message.role === "user");
          return { body: { notebookId, text: question ? messageText(question) : "" } };
        },
      }),
  );
  const { messages, sendMessage, regenerate, stop, status, error, setMessages } = useChat<ChatUIMessage>({
    id: notebookId,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  // An answer that failed before any text (e.g. an empty answer) leaves no empty bubble behind.
  useEffect(() => {
    if (status !== "error") return;
    setMessages((current) => {
      const last = current.at(-1);
      return last?.role === "assistant" && !messageText(last).trim() ? current.slice(0, -1) : current;
    });
  }, [status, setMessages]);

  const lastIsAnswerWithText = messages.at(-1)?.role === "assistant" && messageText(messages.at(-1)!).length > 0;

  return (
    <section aria-labelledby="ask-heading" className="flex min-h-0 min-w-0 flex-1 flex-col lg:basis-3/5">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6">
        <h2 id="ask-heading" className="text-sm font-medium">
          Ask
        </h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex lg:hidden">
              Reader
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Reader</SheetTitle>
            </SheetHeader>
            <div className="px-4">
              <ReaderContent />
            </div>
          </SheetContent>
        </Sheet>
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
          </div>
        </div>
      ) : (
        <MessageList
          messages={messages}
          waiting={busy && !lastIsAnswerWithText}
          error={status === "error" && error ? chatErrorMessage(error) : null}
          onRetry={() => void regenerate()}
        />
      )}

      <div className="px-4 pb-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <AskInput
            disabled={!hasReadySource}
            busy={busy}
            onSend={(text) => void sendMessage({ text })}
            onStop={() => void stop()}
          />
        </div>
      </div>
    </section>
  );
}
