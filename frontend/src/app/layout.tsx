import type { Metadata } from "next";
import "./globals.css";

// Placeholder until NB-002.3 adds APP_NAME in src/lib/config.ts.
export const metadata: Metadata = {
  title: "Untitled notebook app",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
