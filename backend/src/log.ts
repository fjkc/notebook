import { ERROR_CODES, type ErrorCode } from "./shared/error-codes";

/** The only fields a log line may carry, so secrets or document text can't be logged by accident. */
export type LogFields = {
  route: string;
  /** First 8 characters of the owner_id; longer values are cut. */
  ownerPrefix?: string;
  durationMs: number;
  outcome: "ok" | "error";
  errorCode?: ErrorCode;
};

const OWNER_PREFIX_LENGTH = 8;

/**
 * Builds the log record from an allow-list. Accepts `unknown` input on purpose: anything not listed
 * in LogFields is dropped, even if a caller passes it in a loosely typed object.
 */
export function buildLogLine(fields: Record<string, unknown>): LogFields & { level: "info" | "error" } {
  const outcome = fields.outcome === "error" ? "error" : "ok";
  const line: LogFields & { level: "info" | "error" } = {
    level: outcome === "error" ? "error" : "info",
    route: typeof fields.route === "string" ? fields.route : "unknown",
    durationMs: typeof fields.durationMs === "number" ? Math.round(fields.durationMs) : 0,
    outcome,
  };
  if (typeof fields.ownerPrefix === "string" && fields.ownerPrefix.length > 0) {
    line.ownerPrefix = fields.ownerPrefix.slice(0, OWNER_PREFIX_LENGTH);
  }
  if (typeof fields.errorCode === "string" && Object.hasOwn(ERROR_CODES, fields.errorCode)) {
    line.errorCode = fields.errorCode as ErrorCode;
  }
  return line;
}

/** Writes one structured JSON line per operation (docs/ARCHITECTURE.md → "Observability"). */
export function logOperation(fields: LogFields): void {
  const line = buildLogLine(fields);
  const text = JSON.stringify(line);
  if (line.level === "error") console.error(text);
  else console.log(text);
}
