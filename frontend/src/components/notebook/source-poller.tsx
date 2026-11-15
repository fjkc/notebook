"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SOURCE_POLL_MS } from "@repo/backend/shared";

/**
 * Refreshes the page every SOURCE_POLL_MS while a source is pending or processing (NB-007 R14), so
 * chips follow the status even after a reload mid-processing. Pauses while the tab is hidden and
 * refreshes once when it's visible again. Renders nothing.
 */
export function SourcePoller({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(tick, SOURCE_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, router]);

  return null;
}
