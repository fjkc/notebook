"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NEXT = {
  light: { next: "dark", label: "Switch to dark theme", Icon: SunIcon },
  dark: { next: "system", label: "Use the system theme", Icon: MoonIcon },
  system: { next: "light", label: "Switch to light theme", Icon: MonitorIcon },
} as const;

const subscribe = () => () => {};

/** Cycles light → dark → system (DESIGN.md → "Theme"). */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser: render a neutral placeholder on the server
  // and during hydration, so the label can't mismatch.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Change theme">
        <MonitorIcon />
      </Button>
    );
  }

  const current = theme === "light" || theme === "dark" ? theme : "system";
  const { next, label, Icon } = NEXT[current];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={() => setTheme(next)}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
