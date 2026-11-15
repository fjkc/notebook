"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createNotebook as create } from "@repo/backend";
import { runAction, type ActionResult } from "@/lib/action";

/**
 * Home: creates an "Untitled notebook" and opens it. Used with useActionState; it needs neither the
 * previous state nor the form data, so it leaves both parameters out.
 */
export async function createNotebook(): Promise<ActionResult<never>> {
  const result = await runAction("createNotebook", (ownerId) => create(ownerId));
  if (!result.ok) return result;
  revalidatePath("/");
  redirect(`/notebook/${result.data.id}`);
}
