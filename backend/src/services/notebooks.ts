import "server-only";
import { z } from "zod";
import * as notebooks from "../db/notebooks";
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
  await notebooks.remove(ownerId, id);
}
