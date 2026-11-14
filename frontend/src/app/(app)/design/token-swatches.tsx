"use client";

import { useEffect, useState } from "react";

const TOKENS = ["paper", "surface", "ink", "graphite", "rule", "edge", "hook", "marker", "danger"] as const;
type Token = (typeof TOKENS)[number];

function readTokens(): Record<Token, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    TOKENS.map((name) => [name, style.getPropertyValue(`--${name}`).trim()]),
  ) as Record<Token, string>;
}

/**
 * Swatches with the token values of the current theme, read from the CSS variables, so this
 * file holds no colours. next-themes sets the class on <html> in its own effect, after ours,
 * so the values are re-read when that class actually changes, not when resolvedTheme does.
 */
export function TokenSwatches() {
  const [values, setValues] = useState<Record<Token, string> | null>(null);

  useEffect(() => {
    const update = () => setValues(readTokens());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
      {TOKENS.map((name) => (
        <li key={name} className="flex items-center gap-3">
          <span
            className="size-10 shrink-0 rounded-md border border-rule"
            style={{ background: `var(--${name})` }}
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium">{name}</span>
            <span className="font-mono text-xs text-graphite">{values?.[name] ?? "…"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
