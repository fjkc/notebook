// Control characters other than tab, newline and carriage return; Postgres text columns reject U+0000.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Removes control characters (e.g. U+0000 from some PDF fonts) that would make the chunk insert fail.
 * The extractors call it before their minimum-text checks, so text made only of them counts as empty.
 */
export function stripControlChars(text: string): string {
  return text.replace(CONTROL_CHARS, "");
}
