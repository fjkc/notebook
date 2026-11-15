"use server";

import { revalidatePath } from "next/cache";
import { deleteNotebook as remove, renameNotebook as rename } from "@repo/backend";
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
 * not-found view. The client's router.replace("/") fetches a fresh home page (dynamic pages aren't
 * kept in the client cache).
 */
export async function deleteNotebook(input: { id: string }): Promise<ActionResult<null>> {
  return runAction("deleteNotebook", async (ownerId) => {
    await remove(ownerId, input);
    return null;
  });
}
