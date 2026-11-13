// Server-only: importing @repo/backend already fails the build in a Client Component.
import type { NextRequest } from "next/server";
import { AppError, logOperation, toErrorBody, type ErrorCode } from "@repo/backend";

function errorResponse(error: unknown, route: string): { response: Response; code: ErrorCode } {
  const { status, body } = toErrorBody(error);
  if (!(error instanceof AppError) && body.error.code === "INTERNAL") {
    // The only place unknown error details are written; logOperation stays allow-listed.
    console.error(`[${route}] unexpected error`, error);
  }
  return { response: Response.json(body, { status }), code: body.error.code };
}

/**
 * Turns any thrown value into a JSON error Response with `{ error: { code, message } }`.
 * The details of unknown errors go to the server log only, never into the body.
 */
export function toErrorResponse(error: unknown, route = "unknown"): Response {
  return errorResponse(error, route).response;
}

const OWNER_COOKIE = "owner_id";
const OWNER_PREFIX_LENGTH = 8;

/** Reads the owner cookie without throwing; the health route and first visits have none. */
function ownerPrefixOf(request: NextRequest): string | undefined {
  try {
    return request.cookies.get(OWNER_COOKIE)?.value.slice(0, OWNER_PREFIX_LENGTH) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wraps a Route Handler: catches everything and logs one line with duration and outcome.
 * Usage: `export const GET = withRoute("health", async (request) => { … })`.
 */
export function withRoute<Context>(
  name: string,
  handler: (request: NextRequest, context: Context) => Promise<Response>,
): (request: NextRequest, context: Context) => Promise<Response> {
  return async (request, context) => {
    const started = performance.now();
    const ownerPrefix = ownerPrefixOf(request);
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
