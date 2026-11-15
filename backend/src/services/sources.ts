import "server-only";
import { z } from "zod";
import * as chunksDb from "../db/chunks";
import * as sources from "../db/sources";
import { AppError, describeError, toUserMessage } from "../errors";
import { chunkPages, type PageText } from "../rag/chunk";
import { embedDocuments } from "../rag/embed";
import { extractText } from "../rag/extract";
import { summarizeSource } from "../rag/summarize";
import { ERROR_CODES } from "../shared/error-codes";
import {
  MAX_NEW_SOURCES_PER_OWNER_PER_HOUR,
  MAX_PASTED_TEXT_CHARS,
  MAX_SOURCE_TITLE_CHARS,
  MAX_SOURCES_PER_NOTEBOOK,
  PROCESS_BUDGET_MS,
  STUCK_SOURCE_MS,
} from "../shared/limits";
import { assertNotebookOwner, assertSourceOwner } from "./ownership";

export type { SourceStatus, SourceType } from "../db/sources";

/** What the Shelf gets for each source. */
export type SourceListItem = Pick<
  sources.SourceRow,
  "id" | "type" | "title" | "status" | "error" | "pageCount" | "charCount" | "summary" | "createdAt"
>;

const STUCK_MESSAGE = "Processing timed out.";
/**
 * Shown as stuck a little after claim_source accepts it: effectiveStatus uses this server's clock,
 * the claim uses Postgres now(), so a small skew must not offer a "Try again" that gets a 409.
 */
export const CLOCK_SKEW_MARGIN_MS = 30_000;
const HOUR_MS = 60 * 60 * 1000;
const formatCount = (n: number) => n.toLocaleString("en-US");

// IDs are checked by the ownership asserts (malformed → NOT_FOUND), so here they only need to be strings.
const CreateTextSourceInput = z.object({
  notebookId: z.string(),
  title: z
    .string()
    .trim()
    .max(MAX_SOURCE_TITLE_CHARS, `Titles can be up to ${MAX_SOURCE_TITLE_CHARS} characters.`)
    .optional()
    .transform((title) => title || undefined),
  text: z
    .string()
    .trim()
    .min(1, "Paste some text first.")
    .max(MAX_PASTED_TEXT_CHARS, `Pasted text can be up to ${formatCount(MAX_PASTED_TEXT_CHARS)} characters.`),
});
const DeleteSourceInput = z.object({ id: z.string() });

/**
 * A pending or processing source whose updated_at is more than STUCK_SOURCE_MS (plus a clock-skew margin) old is shown as
 * failed with "Processing timed out." Computed on read, never written; claim_source accepts it.
 */
export function effectiveStatus<T extends Pick<sources.SourceRow, "status" | "error" | "updatedAt">>(
  row: T,
  now: number,
): T {
  const inFlight = row.status === "pending" || row.status === "processing";
  if (inFlight && now - Date.parse(row.updatedAt) > STUCK_SOURCE_MS + CLOCK_SKEW_MARGIN_MS) {
    return { ...row, status: "failed", error: STUCK_MESSAGE };
  }
  return row;
}

/**
 * Title for a pasted text: its first non-empty line without leading "#" and whitespace, cut at a word
 * boundary to MAX_SOURCE_TITLE_CHARS including the "…", never inside a surrogate pair.
 */
export function textTitle(text: string): string {
  const line =
    text
      .split(/\r?\n/)
      .map((l) => l.replace(/^[#\s]+/, "").trim())
      .find(Boolean) ?? "";
  if (!line) return "Pasted text";
  if (line.length <= MAX_SOURCE_TITLE_CHARS) return line;

  let cut = line.slice(0, MAX_SOURCE_TITLE_CHARS - 1);
  const lastSpace = cut.search(/\s\S*$/);
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  else if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export async function listSources(ownerId: string, notebookId: unknown): Promise<SourceListItem[]> {
  await assertNotebookOwner(ownerId, notebookId);
  const rows = await sources.listByNotebook(ownerId, notebookId as string);
  const now = Date.now();
  return rows.map((row) => {
    const { id, type, title, status, error, pageCount, charCount, summary, createdAt } = effectiveStatus(row, now);
    return { id, type, title, status, error, pageCount, charCount, summary, createdAt };
  });
}

export async function createTextSource(
  ownerId: string,
  input: unknown,
): Promise<{ sourceId: string; notebookId: string }> {
  const { notebookId, title, text } = CreateTextSourceInput.parse(input);
  await assertNotebookOwner(ownerId, notebookId);

  // Count then insert without a lock: a burst may overshoot by a few, harmless behind the password gate.
  if ((await sources.countInNotebook(ownerId, notebookId)) >= MAX_SOURCES_PER_NOTEBOOK) {
    throw new AppError("LIMIT_REACHED", `A notebook can have up to ${MAX_SOURCES_PER_NOTEBOOK} sources.`);
  }
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  if ((await sources.countCreatedSince(ownerId, since)) >= MAX_NEW_SOURCES_PER_OWNER_PER_HOUR) {
    throw new AppError(
      "LIMIT_REACHED",
      `You've added ${MAX_NEW_SOURCES_PER_OWNER_PER_HOUR} sources in the last hour. Try again later.`,
    );
  }

  const { id } = await sources.insert(ownerId, {
    notebookId,
    type: "text",
    title: title ?? textTitle(text),
    inputText: text,
  });
  return { sourceId: id, notebookId };
}

/**
 * Best-effort summary: a failure (quota, timeout) is logged and the source still becomes ready
 * without one, because its chunks are already stored and usable in answers (NB-007 Notes).
 */
async function trySummary(text: string, signal: AbortSignal): Promise<string | null> {
  try {
    return await summarizeSource(text, signal);
  } catch (error) {
    console.error("[processSource] summary skipped", JSON.stringify(describeError(error)));
    return null;
  }
}

function extract(source: sources.SourceForProcessing): PageText[] {
  if (source.type === "text" && source.inputText) return extractText(source.inputText);
  throw new Error(`No extractor for source type ${source.type}`);
}

/**
 * Runs the pipeline for one source (docs/ARCHITECTURE.md §6): claim → extract → chunk → embed →
 * insert chunks → summary → ready. Any failure after the claim marks the source failed and rethrows.
 * A source deleted mid-run surfaces as NOT_FOUND, which the client ignores.
 */
export async function processSource(ownerId: string, sourceId: unknown): Promise<{ status: "ready" }> {
  await assertSourceOwner(ownerId, sourceId);
  const id = sourceId as string;
  const source = await sources.claim(ownerId, id);
  if (!source) {
    // Not claimable: running, ready, or deleted meanwhile.
    throw new AppError((await sources.getOwned(ownerId, id)) ? "ALREADY_PROCESSING" : "NOT_FOUND");
  }

  const budget = AbortSignal.timeout(PROCESS_BUDGET_MS);
  try {
    const pages = extract(source);
    const chunks = chunkPages(pages);
    if (chunks.length === 0) throw new Error("Source has no text to chunk");

    const embeddings = await embedDocuments(
      chunks.map((chunk) => chunk.content),
      budget,
    );
    await chunksDb.insertMany(
      chunks.map((chunk, i) => ({
        sourceId: id,
        notebookId: source.notebookId,
        chunkIndex: chunk.chunkIndex,
        page: chunk.page,
        content: chunk.content,
        embedding: embeddings[i]!,
      })),
      budget,
    );

    const text = pages.map((page) => page.text).join("\n\n");
    const summary = await trySummary(text, budget);
    const pageCount = pages.some((page) => page.page !== null) ? pages.length : null;
    // Not under the budget (own 5 s timeout): an abort after the server committed would turn a finished source into failed.
    const updated = await sources.markReady(ownerId, id, { summary, pageCount, charCount: text.length });
    if (!updated) throw new AppError("NOT_FOUND");
    return { status: "ready" };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") throw error;
    const message = error instanceof AppError ? toUserMessage(error) : ERROR_CODES.INTERNAL.message;
    // No row updated: deleted meanwhile, or markReady committed after all. Either way the client ignores NOT_FOUND.
    if (!(await sources.markFailed(ownerId, id, message))) throw new AppError("NOT_FOUND");
    throw error;
  }
}

export async function deleteSource(ownerId: string, input: unknown): Promise<{ notebookId: string }> {
  const { id } = DeleteSourceInput.parse(input);
  const source = await assertSourceOwner(ownerId, id);
  await sources.remove(ownerId, id);
  return { notebookId: source.notebookId };
}
