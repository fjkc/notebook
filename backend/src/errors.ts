import { ZodError } from "zod";
import {
  CODES_WITH_SPECIFIC_MESSAGE,
  ERROR_CODES,
  type ErrorBody,
  type ErrorCode,
} from "./shared/error-codes";

type SpecificCode = (typeof CODES_WITH_SPECIFIC_MESSAGE)[number];
type AppErrorOptions = { cause?: unknown };

/**
 * An expected failure with a known code. Unexpected errors are left as they are and become INTERNAL.
 * Pass the underlying failure as `cause` (e.g. the network error behind URL_FETCH_FAILED) so it gets logged.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  /** Set only for VALIDATION and LIMIT_REACHED, which may tell the user exactly what's wrong. */
  readonly userMessage?: string;

  constructor(code: SpecificCode, userMessage?: string, options?: AppErrorOptions);
  constructor(code: Exclude<ErrorCode, SpecificCode>, options?: AppErrorOptions);
  constructor(code: ErrorCode, messageOrOptions?: string | AppErrorOptions, options?: AppErrorOptions) {
    const userMessage = typeof messageOrOptions === "string" ? messageOrOptions : undefined;
    const opts = typeof messageOrOptions === "object" ? messageOrOptions : options;
    super(code, opts?.cause === undefined ? undefined : { cause: opts.cause });
    this.name = "AppError";
    this.code = code;
    if (userMessage && (CODES_WITH_SPECIFIC_MESSAGE as readonly ErrorCode[]).includes(code)) {
      this.userMessage = userMessage;
    }
  }
}

/** The message the user sees for an AppError: the specific one if set, else the code's default. */
export function toUserMessage(error: AppError): string {
  return error.userMessage ?? ERROR_CODES[error.code].message;
}

const MAX_VALIDATION_MESSAGE = 200;

/**
 * Maps any thrown value to a status and the public error body. Pure, so all mapping is unit-tested here.
 * AppError → its code; ZodError → VALIDATION with the first issue's message; anything else → INTERNAL.
 * Never puts details of unknown errors into the body.
 *
 * A ZodError always means "the input is invalid". Code that parses data it controls (env, DB rows,
 * model output) must catch its ZodError and throw a plain Error, so the user gets INTERNAL instead.
 */
export function toErrorBody(error: unknown): { status: number; body: ErrorBody } {
  let code: ErrorCode = "INTERNAL";
  let message: string = ERROR_CODES.INTERNAL.message;

  if (error instanceof AppError) {
    code = error.code;
    message = toUserMessage(error);
  } else if (error instanceof ZodError) {
    code = "VALIDATION";
    const first = error.issues[0]?.message.trim();
    message = first ? first.slice(0, MAX_VALIDATION_MESSAGE) : ERROR_CODES.VALIDATION.message;
  }

  return { status: ERROR_CODES[code].status, body: { error: { code, message } } };
}

export type ErrorSummary = {
  name: string;
  message?: string;
  stack?: string;
  /** For a ZodError: where and why validation failed, never the offending values. */
  issues?: { path: string; code: string }[];
  cause?: ErrorSummary;
};

const MAX_LOG_MESSAGE = 300;
const MAX_LOG_ISSUES = 5;
const MAX_CAUSE_DEPTH = 2;
const MAX_STACK_FRAMES = 10;

/**
 * A bounded summary of any thrown value for the server log. Never copies an error's own properties
 * (provider errors carry request and response bodies with document text), keeps only the first line
 * of the message, cut to 300 characters, and only the stack's frame lines.
 */
export function describeError(error: unknown, depth = 0): ErrorSummary {
  if (!(error instanceof Error)) return { name: typeof error };

  const summary: ErrorSummary = {
    name: error.name,
    // Messages can carry content too (parse errors embed the offending text), often on later lines.
    message: error.message.split("\n")[0]?.slice(0, MAX_LOG_MESSAGE),
    // The stack starts with the whole message, which can span several lines; keep only the frames.
    stack: error.stack
      ?.split("\n")
      .filter((line) => /^\s+at /.test(line))
      .slice(0, MAX_STACK_FRAMES)
      .join("\n"),
  };
  if (error instanceof ZodError) {
    // zod's message embeds all issues; keep only paths and codes.
    delete summary.message;
    summary.issues = error.issues.slice(0, MAX_LOG_ISSUES).map((issue) => ({
      path: issue.path.map(String).join("."),
      code: issue.code,
    }));
  }
  if (error.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    summary.cause = describeError(error.cause, depth + 1);
  }
  return summary;
}
