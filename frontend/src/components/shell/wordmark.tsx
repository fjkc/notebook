import { APP_NAME } from "@/lib/config";

/** The hook glyph: one stroke, a short vertical line that ends in a round hook (DESIGN.md → "Wordmark"). */
export function HookGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 3.5v10.5a4.75 4.75 0 0 1-9.5 0" />
    </svg>
  );
}

/** "Notehooked" in Newsreader with the hook glyph in plum before it. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <HookGlyph className="size-5 text-hook" />
      <span className="font-reading text-xl leading-none font-medium tracking-tight">{APP_NAME}</span>
    </span>
  );
}
