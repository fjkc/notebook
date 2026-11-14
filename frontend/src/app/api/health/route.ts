import { checkDatabase } from "@repo/backend";
import { withRoute } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public keep-alive and health check, called daily by the Vercel cron. Never returns error details. */
export const GET = withRoute("health", async () => {
  const db = await checkDatabase();
  return Response.json(
    { ok: db, db, timestamp: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
});
