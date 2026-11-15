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

/** Doesn't redirect: the client shows the toast first, then navigates (NB-006 R10). */
export async function deleteNotebook(input: { id: string }): Promise<ActionResult<null>> {
  const result = await runAction("deleteNotebook", async (ownerId) => {
    await remove(ownerId, input);
    return null;
  });
  if (result.ok) revalidatePath("/");
  return result;
}
