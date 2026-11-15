import { APP_NAME } from "@/lib/config";

/**
 * The mark (DESIGN.md → "Wordmark and favicon"): a fishhook (eye, shank, bend, barb) with a note
 * hooked on its bend. The hook takes the current colour; the note uses the marker and ink tokens.
 * The bend passes behind a short strip of the note, so it looks threaded through the paper.
 * Same geometry as app/icon.svg. No ids, so it can appear several times on one page.
 */
export function HookMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <g transform="rotate(-8 16 20)">
        <rect x="8.5" y="18.6" width="15" height="11.6" rx="1.6" fill="var(--marker)" />
        <path
          d="M11.5 24.4h9M11.5 27.1h6"
          stroke="var(--ink)"
          strokeOpacity={0.55}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="21" cy="4.4" r="2.1" />
        <path d="M21 6.5v8.4a5 5 0 0 1-10 0V11.6" />
        <path d="M11 11.6l2.6 2.4" />
      </g>
      <g transform="rotate(-8 16 20)">
        <rect x="12.2" y="18.6" width="3.8" height="4" fill="var(--marker)" />
      </g>
      <circle cx="16" cy="20" r="1.05" fill="currentColor" />
    </svg>
  );
}

/**
 * "Notehooked" in Newsreader with the mark in plum before it. `compact` hides the name below 640 px
 * (kept for screen readers), so a notebook title next to it gets the room.
 */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <HookMark className="size-7 text-hook" />
      <span
        className={`font-reading text-xl leading-none font-medium tracking-tight ${compact ? "max-sm:sr-only" : ""}`}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
