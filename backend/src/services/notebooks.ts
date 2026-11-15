import "server-only";
import { z } from "zod";
import { generateSuggestedQuestions } from "../ai/suggestions";
import * as notebooks from "../db/notebooks";
import * as sources from "../db/sources";
import * as storage from "../db/storage";
import { AppError } from "../errors";
import { MAX_NOTEBOOKS_PER_OWNER } from "../shared/limits";
import { NotebookTitle } from "../shared/notebook-title";
import { assertNotebookOwner } from "./ownership";

export type { Notebook, NotebookListItem } from "../db/notebooks";

// IDs are checked by assertNotebookOwner (malformed → NOT_FOUND), so here they only need to be strings.
const RenameNotebookInput = z.object({ id: z.string(), title: NotebookTitle });
const DeleteNotebookInput = z.object({ id: z.string() });

export async function listNotebooks(ownerId: string): Promise<notebooks.NotebookListItem[]> {
  return notebooks.listByOwner(ownerId);
}

/** Throws NOT_FOUND for a malformed, unknown or foreign ID. */
export async function getNotebook(ownerId: string, id: unknown): Promise<notebooks.Notebook> {
  await assertNotebookOwner(ownerId, id);
  // assertNotebookOwner has checked that id is a UUID string.
  const notebook = await notebooks.getOwned(ownerId, id as string);
  // Deleted between the two queries.
  if (!notebook) throw new AppError("NOT_FOUND");
  return notebook;
}

/**
 * Creates a notebook titled "Untitled notebook" (the schema default). Count then insert, without a
 * lock: a burst of parallel creates may overshoot the limit. Harmless here, since the app is behind
 * the password gate and a new owner cookie gives a fresh allowance anyway.
 */
export async function createNotebook(ownerId: string): Promise<{ id: string }> {
  if ((await notebooks.countByOwner(ownerId)) >= MAX_NOTEBOOKS_PER_OWNER) {
    throw new AppError(
      "LIMIT_REACHED",
      `You can have up to ${MAX_NOTEBOOKS_PER_OWNER} notebooks. Delete one to make room.`,
    );
  }
  return notebooks.insert(ownerId);
}

export async function renameNotebook(ownerId: string, input: unknown): Promise<{ id: string }> {
  const { id, title } = RenameNotebookInput.parse(input);
  await assertNotebookOwner(ownerId, id);
  const row = await notebooks.updateTitle(ownerId, id, title);
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function deleteNotebook(ownerId: string, input: unknown): Promise<void> {
  const { id } = DeleteNotebookInput.parse(input);
  await assertNotebookOwner(ownerId, id);
  // Listed before the delete (the rows go with the notebook), removed after; never fails the delete (NB-008 R12).
  const paths = await sources.listStoragePaths(ownerId, id);
  await notebooks.remove(ownerId, id);
  await storage.removeQuietly(paths);
}

/**
 * Regenerates the notebook's suggested questions from its ready sources' summaries (NB-010 R5).
 * No summaries → stores [] without a Gemini call. Nothing left after cleaning keeps the old ones.
 * Throws on failure; the callers log and swallow it. Called only from services that have already
 * checked ownership, so the IDs are trusted here. `signal` caps the whole step (the process route's deadline).
 *
 * Two refreshes can overlap (sources finishing close together, a delete during processing). The
 * summaries are read again before the write, and a refresh whose set changed meanwhile doesn't
 * write: the refresh started by that change covers the newer set. Unless the set only grew and
 * nothing is stored yet: that refresh may still fail (a 429, the deadline), and some questions beat none.
 */
export async function refreshSuggestedQuestions(ownerId: string, notebookId: string, signal?: AbortSignal): Promise<void> {
  const summaries = await sources.listReadySummaries(ownerId, notebookId, signal);
  if (summaries.length === 0) {
    await notebooks.setSuggestedQuestions(ownerId, notebookId, [], signal);
    return;
  }
  const questions = await generateSuggestedQuestions(summaries, signal);
  if (questions.length === 0) return;
  const current = await sources.listReadySummaries(ownerId, notebookId, signal);
  const changed = current.length !== summaries.length || current.some((summary, i) => summary !== summaries[i]);
  if (changed) {
    // Only a set that purely grew may still write (when nothing is stored): after a delete, these
    // questions could be about the deleted source, and the delete's own refresh owns that state.
    const onlyGrew = current.length > 0 && summaries.every((summary) => current.includes(summary));
    if (!onlyGrew || (await notebooks.getSuggestedQuestions(ownerId, notebookId, signal)).length > 0) return;
  }
  await notebooks.setSuggestedQuestions(ownerId, notebookId, questions, signal);
}
