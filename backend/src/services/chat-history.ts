// Pure helpers for the chat service (NB-009 R7, R9), kept apart so they're tested without I/O.
import { stripCitationMarkers } from "../shared/citations";

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The model's conversation history from stored messages (oldest first): only a user message directly
 * followed by an assistant message is kept, so turns always alternate and unanswered questions (after
 * an error or "Stop") are dropped. Old citation markers are stripped: each turn numbers its passages from 1.
 */
export function buildHistory(messages: readonly Turn[]): Turn[] {
  const history: Turn[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const question = messages[i]!;
    const answer = messages[i + 1]!;
    if (question.role === "user" && answer.role === "assistant") {
      history.push({ role: "user", content: question.content });
      history.push({ role: "assistant", content: stripCitationMarkers(answer.content) });
      i++;
    }
  }
  return history;
}

/** Leaves out a user message directly followed by another user message with the same text (a resend). */
export function collapseResends<T extends Turn>(messages: readonly T[]): T[] {
  return messages.filter((message, i) => {
    const next = messages[i + 1];
    return !(message.role === "user" && next?.role === "user" && next.content.trim() === message.content.trim());
  });
}

/** An answer with no text after trimming (e.g. a safety block) is never saved or shown. */
export function isEmptyAnswer(text: string): boolean {
  return text.trim().length === 0;
}
