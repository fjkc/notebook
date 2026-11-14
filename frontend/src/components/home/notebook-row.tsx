import Link from "next/link";

export type NotebookRowProps = {
  href: string;
  title: string;
  sourceCount: number;
  /** Already formatted, e.g. "12 Nov". */
  edited: string;
};

/** One notebook in the home list (DESIGN.md → "Layout", home). Rows with dividers, not cards. */
export function NotebookRow({ href, title, sourceCount, edited }: NotebookRowProps) {
  return (
    <li className="border-b border-rule last:border-b-0">
      <Link
        href={href}
        className="flex flex-col gap-1 rounded-sm px-1 py-4 transition-colors duration-150 hover:bg-surface sm:px-3"
      >
        <span className="font-reading text-[1.0625rem] leading-snug font-medium break-words">{title}</span>
        <span className="text-sm text-graphite">
          {sourceCount === 1 ? "1 source" : `${sourceCount} sources`} · edited {edited}
        </span>
      </Link>
    </li>
  );
}
