"use client";

import { useLayoutEffect, useRef } from "react";
import type { Citation } from "@repo/backend/shared";
import { messageText, type ChatUIMessage } from "@/lib/chat";
import { Button } from "@/components/ui/button";
import { AnswerMarkdown } from "./answer-markdown";

const NO_CITATIONS: Citation[] = [];

/** Distance from the bottom, in px, that still counts as "at the bottom" for following the stream. */
const BOTTOM_SLACK_PX = 48;

type MessageListProps = {
  messages: ChatUIMessage[];
  /** True while waiting for the first part of an answer. */
  waiting: boolean;
  error: string | null;
  /** Null hides "Try again" (e.g. while every source is excluded). */
  onRetry: (() => void) | null;
};

/**
 * The conversation (NB-009 R12): questions right-aligned on surface, answers in the reading face on
 * paper. Scrolls to the newest question when one is sent, and follows the stream only while the
 * user is at the bottom.
 */
export function MessageList({ messages, waiting, error, onRetry }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastQuestionId = messages.findLast((m) => m.role === "user")?.id;

  // A new question (or the first render with history) always scrolls to the bottom.
  useLayoutEffect(() => {
    atBottom.current = true;
  }, [lastQuestionId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  });

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const el = event.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
    >
      <ol className="mx-auto flex w-full max-w-2xl flex-col gap-6" aria-label="Conversation">
        {messages.map((message) => {
          const text = messageText(message);
          if (message.role === "user") {
            return (
              <li key={message.id} className="ml-auto max-w-[85%] rounded-lg bg-surface px-4 py-2.5 whitespace-pre-wrap break-words">
                {text}
              </li>
            );
          }
          if (!text) return null;
          return (
            <li key={message.id} className="font-reading rounded-lg bg-paper text-[1.0625rem] leading-relaxed">
              <AnswerMarkdown messageId={message.id} text={text} citations={message.metadata?.citations ?? NO_CITATIONS} />
            </li>
          );
        })}
        {waiting && (
          <li className="text-sm text-graphite" aria-live="polite">
            Reading your sources…
          </li>
        )}
        {error && (
          <li role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
            <span>{error}</span>
            {onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            )}
          </li>
        )}
      </ol>
    </div>
  );
}
