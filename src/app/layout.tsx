/**
 * Root layout: document shell and global styles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/layout.tsx
 * Deps:    next, tailwindcss
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Metadata and the <html>/<body> wrapper for every page
 *
 * Design constraints:
 * - No runtime = "edge"; no next/font network fetch at build (keep system fonts)
 */
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "oldboys — sourced deep research",
  description: "Subject + anchor + goal in; a report where every claim links to a source.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="flex size-7 items-center justify-center rounded-md bg-teal-500 text-xs text-zinc-950">CB</span>
              Candidate Brief
            </Link>
            <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
              New brief
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
