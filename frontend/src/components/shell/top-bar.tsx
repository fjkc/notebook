import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

/** App shell (DESIGN.md → "App shell"): wordmark home link on the left, theme toggle on the right. */
export function TopBar() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="rounded-sm">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
