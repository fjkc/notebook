// Server-only: importing @repo/backend already fails the build in a Client Component.
import { unstable_rethrow } from "next/navigation";
import { logOperation, type ErrorCode } from "@repo/backend";
import { toLoggedErrorBody } from "./http";
import { getOwnerId } from "./owner";

/** What every Server Action returns: data, or a code with the message the user may see. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

/**
 * Runs a Server Action's work for the current owner. Catches everything, maps it to the error
 * result (never a raw error) and logs one line per call, like withRoute. Next's control-flow throws
 * (redirect, notFound) are rethrown; call redirect after runAction so the success line is logged.
 *
 * Usage: `const result = await runAction("renameNotebook", (ownerId) => renameNotebook(ownerId, input))`.
 */
export async function runAction<T>(
  name: string,
  fn: (ownerId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  const started = performance.now();
  let ownerId: string | undefined;
  try {
    ownerId = await getOwnerId();
    const data = await fn(ownerId);
    logOperation({ route: name, ownerPrefix: ownerId, durationMs: performance.now() - started, outcome: "ok" });
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    const { body } = toLoggedErrorBody(error, name);
    logOperation({
      route: name,
      ownerPrefix: ownerId,
      durationMs: performance.now() - started,
      outcome: "error",
      errorCode: body.error.code,
    });
    return { ok: false, error: body.error };
  }
}
