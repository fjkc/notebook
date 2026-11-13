import { ZodError } from "zod";
import {
  CODES_WITH_SPECIFIC_MESSAGE,
  ERROR_CODES,
  type ErrorBody,
  type ErrorCode,
} from "./shared/error-codes";

type SpecificCode = (typeof CODES_WITH_SPECIFIC_MESSAGE)[number];

/** An expected failure with a known code. Unexpected errors are left as they are and become INTERNAL. */
export class AppError extends Error {
  readonly code: ErrorCode;
  /** Set only for VALIDATION and LIMIT_REACHED, which may tell the user exactly what's wrong. */
  readonly userMessage?: string;

  constructor(code: SpecificCode, userMessage?: string);
  constructor(code: Exclude<ErrorCode, SpecificCode>);
  constructor(code: ErrorCode, userMessage?: string) {
    super(code);
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
