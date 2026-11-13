import "server-only";
import { z } from "zod";
import * as notebooks from "../db/notebooks";
import { AppError } from "../errors";

const Uuid = z.uuid();

/**
 * Throws NOT_FOUND unless the notebook exists and belongs to the owner. Malformed IDs get
 * NOT_FOUND too (never VALIDATION), so IDs can't be probed. Call it first in every service
 * that takes a notebook or source ID.
 */
export async function assertNotebookOwner(ownerId: unknown, notebookId: unknown): Promise<void> {
  const owner = Uuid.safeParse(ownerId);
  const notebook = Uuid.safeParse(notebookId);
  if (!owner.success || !notebook.success) throw new AppError("NOT_FOUND");

  const row = await notebooks.findOwned(owner.data, notebook.data);
  if (!row) throw new AppError("NOT_FOUND");
}
