"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in sync with the viewport. False on the server and during
 * hydration. Only for behaviour CSS can't express (e.g. which modal sheet to mount), never layout.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True when the OS asks for reduced motion; read at call time, for imperative scrolling. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
