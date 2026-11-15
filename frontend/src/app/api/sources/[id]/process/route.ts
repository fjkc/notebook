import { processSource } from "@repo/backend";
import { withRoute } from "@/lib/http";
import { getOwnerId } from "@/lib/owner";

export const runtime = "nodejs";
// Well below the 5-minute stuck window, so a running call is never re-claimed. The backend's own
// 45 s budget ends the run first and marks the source failed.
export const maxDuration = 60;

/** Runs ingestion for one source (NB-007 R12): 200 { status: "ready" } or the error shape. */
export const POST = withRoute("processSource", async (_request, context: RouteContext<"/api/sources/[id]/process">) => {
  const { id } = await context.params;
  return Response.json(await processSource(await getOwnerId(), id));
});
