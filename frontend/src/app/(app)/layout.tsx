import { TopBar } from "@/components/shell/top-bar";

// Pages with the app shell. /login stays outside this group, so it has no top bar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
