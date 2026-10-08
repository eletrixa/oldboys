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
import "./globals.css";

export const metadata: Metadata = {
  title: "oldboys — sourced deep research",
  description: "Subject + anchor + goal in; a report where every claim links to a source.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
