import Link from "next/link";
import { TopBar } from "@/components/shell/top-bar";

// Same view for an unknown, malformed or foreign ID, with status 404, so IDs can't be probed.
export default function NotebookNotFound() {
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:py-14">
        <h1 className="font-reading text-[1.75rem] leading-tight font-medium">We can&apos;t find this notebook</h1>
        <p className="mt-2 text-graphite">It may have been deleted, or it belongs to another browser.</p>
        <Link href="/" className="mt-6 inline-block rounded-sm text-hook underline-offset-4 hover:underline">
          Back to your notebooks
        </Link>
      </main>
    </>
  );
}
