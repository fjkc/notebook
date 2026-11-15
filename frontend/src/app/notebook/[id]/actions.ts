"use server";

import { revalidatePath } from "next/cache";
import {
  clearChat as clear,
  createTextSource as createText,
  createUrlSource as createUrl,
  deleteNotebook as remove,
  deleteSource as removeSource,
  renameNotebook as rename,
} from "@repo/backend";
import { runAction, type ActionResult } from "@/lib/action";

export async function renameNotebook(input: { id: string; title: string }): Promise<ActionResult<{ id: string }>> {
  const result = await runAction("renameNotebook", (ownerId) => rename(ownerId, input));
  if (result.ok) {
    revalidatePath("/");
    revalidatePath(`/notebook/${result.data.id}`);
  }
  return result;
}

/**
 * Doesn't redirect: the client shows the toast first, then navigates (NB-006 R10). No revalidatePath
 * either: it would re-render the page the action came from, the deleted notebook, and flash the
 * not-found view. The client navigates with router.replace("/") and then router.refresh(), which
 * clears the client router cache so Back doesn't show the deleted notebook either.
 */
export async function deleteNotebook(input: { id: string }): Promise<ActionResult<null>> {
  return runAction("deleteNotebook", async (ownerId) => {
    await remove(ownerId, input);
    return null;
  });
}

/** Adds a pending text source; the client then calls the process route (NB-007 R13). */
export async function createTextSource(input: {
  notebookId: string;
  title?: string;
  text: string;
}): Promise<ActionResult<{ sourceId: string }>> {
  const result = await runAction("createTextSource", (ownerId) => createText(ownerId, input));
  if (!result.ok) return result;
  revalidatePath(`/notebook/${result.data.notebookId}`);
  return { ok: true, data: { sourceId: result.data.sourceId } };
}

/** Adds a pending web page source; the client then calls the process route (NB-008 R7). */
export async function createUrlSource(input: { notebookId: string; url: string }): Promise<ActionResult<{ sourceId: string }>> {
  const result = await runAction("createUrlSource", (ownerId) => createUrl(ownerId, input));
  if (!result.ok) return result;
  revalidatePath(`/notebook/${result.data.notebookId}`);
  return { ok: true, data: { sourceId: result.data.sourceId } };
}

/** Deletes a source in any status; its chunks and its PDF file go with it. */
export async function deleteSource(input: { id: string }): Promise<ActionResult<null>> {
  const result = await runAction("deleteSource", (ownerId) => removeSource(ownerId, input));
  if (!result.ok) return result;
  revalidatePath(`/notebook/${result.data.notebookId}`);
  return { ok: true, data: null };
}

/**
 * Deletes the notebook's conversation (NB-010 R8). No revalidatePath: the client empties the chat
 * itself (useChat reads its initial messages only once), and the next load reads the empty table.
 */
export async function clearChat(input: { notebookId: string }): Promise<ActionResult<null>> {
  return runAction("clearChat", async (ownerId) => {
    await clear(ownerId, input);
    return null;
  });
}
