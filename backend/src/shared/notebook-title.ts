import { z } from "zod";

/** Longest notebook title, in UTF-16 code units (zod's `.max`), so an emoji counts as two. */
export const MAX_NOTEBOOK_TITLE_CHARS = 120;

// Unicode category Cc: C0 controls (incl. tab and line breaks), DEL and C1 controls.
const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * The one title rule for notebooks, shared by the rename dialog and the service. Trims first,
 * then checks in this order: empty, control characters, length. Each failure has its own message.
 */
export const NotebookTitle = z
  .string()
  .trim()
  .min(1, "Give the notebook a name.")
  .refine((title) => !CONTROL_CHARACTER.test(title), "Names can't contain line breaks or control characters.")
  .max(MAX_NOTEBOOK_TITLE_CHARS, `Names can be up to ${MAX_NOTEBOOK_TITLE_CHARS} characters.`);
