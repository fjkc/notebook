import "server-only";
import { z } from "zod";
import { chatSystemPrompt } from "../ai/prompts";
import * as messages from "../db/messages";
import * as sources from "../db/sources";
import { AppError } from "../errors";
import { retrieve } from "../rag/retrieve";
import { usedCitationNumbers, type Citation } from "../shared/citations";
import { isUuid } from "../shared/ids";
import {
  CHAT_HISTORY_MESSAGES,
  MAX_CHAT_MESSAGES_PER_MINUTE,
  MAX_QUESTION_CHARS,
  MAX_SOURCES_PER_NOTEBOOK,
} from "../shared/limits";
import { buildHistory, collapseResends } from "./chat-history";
import { assertNotebookOwner } from "./ownership";

/** A stored chat message as the Ask pane shows it. */
export type ChatMessage = messages.MessageRow;

/** Everything the route needs to stream one answer. */
export type StartedChat = {
  notebookId: string;
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
  citations: Citation[];
};

const ASK_FIRST = "Ask a question first.";
const SOURCES_MESSAGE = "Choose between 1 and 10 sources.";

// Strict: the history comes from the database (R8), so a `messages` key is a VALIDATION error.
// The notebook ID is checked by assertNotebookOwner (malformed → NOT_FOUND).
const StartChatInput = z.strictObject({
  notebookId: z.string(),
  text: z
    .string(ASK_FIRST)
    .trim()
    .min(1, ASK_FIRST)
    .max(MAX_QUESTION_CHARS, `Questions can be up to ${MAX_QUESTION_CHARS.toLocaleString("en-US")} characters.`),
  sourceIds: z
    .array(z.string().refine(isUuid, SOURCES_MESSAGE), SOURCES_MESSAGE)
    .min(1, SOURCES_MESSAGE)
    .max(MAX_SOURCES_PER_NOTEBOOK, SOURCES_MESSAGE)
    .refine((ids) => new Set(ids).size === ids.length, SOURCES_MESSAGE)
    .optional(),
});

const MINUTE_MS = 60_000;

/**
 * Prepares one chat turn (NB-009 R7): validate, authorise, throttle, build the history from stored
 * answered pairs, store the question, retrieve. Every request stores its question, so every request
 * counts toward the throttle, resends included.
 */
export async function startChat(ownerId: string, input: unknown): Promise<StartedChat> {
  const { notebookId, text, sourceIds } = StartChatInput.parse(input);
  await assertNotebookOwner(ownerId, notebookId);
  if (sourceIds && (await sources.countReadyInNotebook(ownerId, notebookId, sourceIds)) !== sourceIds.length) {
    throw new AppError("NOT_FOUND");
  }

  const since = new Date(Date.now() - MINUTE_MS).toISOString();
  if ((await messages.countUserMessagesSince(ownerId, since)) >= MAX_CHAT_MESSAGES_PER_MINUTE) {
    throw new AppError("RATE_LIMITED");
  }

  const history = buildHistory(await messages.listRecent(ownerId, notebookId, CHAT_HISTORY_MESSAGES));
  await messages.insert(ownerId, { notebookId, role: "user", content: text });
  const { citations, passages } = await retrieve(ownerId, notebookId, text, sourceIds ?? null);

  return { notebookId, system: chatSystemPrompt(passages), history, question: text, citations };
}

/** Stores a finished answer with only the citations its text uses. */
export async function saveAnswer(ownerId: string, notebookId: string, text: string, citations: Citation[]) {
  const used = new Set(usedCitationNumbers(text, citations.map((c) => c.n)));
  await messages.insert(ownerId, {
    notebookId,
    role: "assistant",
    content: text,
    citations: citations.filter((c) => used.has(c.n)),
  });
}

/** The notebook's conversation for the page, with resent questions shown once. */
export async function getHistory(ownerId: string, notebookId: unknown): Promise<ChatMessage[]> {
  await assertNotebookOwner(ownerId, notebookId);
  return collapseResends(await messages.listAll(ownerId, notebookId as string));
}
