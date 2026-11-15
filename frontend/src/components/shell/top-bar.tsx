import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

type TopBarProps = {
  /** The notebook title, on notebook pages. Truncated, with the full title in a tooltip. */
  title?: string;
  /** Controls placed before the theme toggle, e.g. the notebook menu. */
  actions?: React.ReactNode;
};

/** App shell (DESIGN.md → "App shell"): wordmark home link, optional notebook title and actions, theme toggle. */
export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-4">
        <Link href="/" className="flex shrink-0 items-center rounded-sm">
          <Wordmark compact={title !== undefined} />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {title !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="min-w-0 truncate font-medium">{title}</h1>
              </TooltipTrigger>
              <TooltipContent className="max-w-80 break-words">{title}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
