// Server-only: importing @repo/backend already fails the build in a Client Component.
import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { AppError, describeError, logOperation, toErrorBody, type ErrorCode } from "@repo/backend";

/**
 * Maps any thrown value to a status and the public error body, and writes the detail line to the log
 * when there is one. Shared by Route Handlers (withRoute) and Server Actions (runAction).
 */
export function toLoggedErrorBody(error: unknown, route: string): ReturnType<typeof toErrorBody> {
  const result = toErrorBody(error);
  // Details go to the log only, as a bounded summary: provider errors carry request bodies with
  // document text. Logged for unknown errors, for zod failures (paths and codes only) and for
  // AppErrors that wrap an underlying cause. logOperation stays strictly allow-listed.
  const isPlainAppError = error instanceof AppError && error.cause === undefined;
  if (!isPlainAppError) {
    console.error(`[${route}] ${result.body.error.code}`, JSON.stringify(describeError(error)));
  }
  return result;
}

function errorResponse(error: unknown, route: string): { response: Response; code: ErrorCode } {
  const { status, body } = toLoggedErrorBody(error, route);
  return { response: Response.json(body, { status }), code: body.error.code };
}

/**
 * Turns any thrown value into a JSON error Response with `{ error: { code, message } }`.
 * Inside `withRoute`, prefer throwing: only thrown errors get their code into the log line.
 */
export function toErrorResponse(error: unknown, route = "unknown"): Response {
  return errorResponse(error, route).response;
}

/**
 * Wraps a Route Handler: catches everything and logs one line with duration and outcome.
 * Usage: `export const GET = withRoute("health", async (request) => { … })`.
 *
 * - Throw `AppError` for expected failures instead of returning an error response, so the
 *   log line carries the error code.
 * - Streaming routes (chat): this logs when the Response is returned, before the stream runs.
 *   Errors inside the stream must be logged from the stream's onError/onFinish.
 * - Next's control-flow throws (redirect, notFound) are rethrown, not turned into a 500.
 */
export function withRoute<Context>(
  name: string,
  handler: (request: NextRequest, context: Context) => Promise<Response>,
): (request: NextRequest, context: Context) => Promise<Response> {
  return async (request, context) => {
    const started = performance.now();
    // logOperation cuts it to 8 characters.
    const ownerPrefix = request.cookies.get("owner_id")?.value;
    try {
      const response = await handler(request, context);
      logOperation({
        route: name,
        ownerPrefix,
        durationMs: performance.now() - started,
        outcome: response.ok ? "ok" : "error",
      });
      return response;
    } catch (error) {
      unstable_rethrow(error);
      const { response, code } = errorResponse(error, name);
      logOperation({
        route: name,
        ownerPrefix,
        durationMs: performance.now() - started,
        outcome: "error",
        errorCode: code,
      });
      return response;
    }
  };
}
