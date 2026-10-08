/**
 * Root layout: document shell, global styles and the site navigation.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/layout.tsx
 * Deps:    next, tailwindcss, ./site-nav, ./api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Metadata and the <html>/<body> wrapper for every page; passes the session user to SiteNav
 *
 * Design constraints:
 * - No runtime = "edge"; no next/font network fetch at build (keep system fonts)
 */
import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "./api/_lib/current-user";
import { SiteNav } from "./site-nav";

export const metadata: Metadata = {
  title: "Candidate Brief",
  description: "A short brief on a candidate, with a source for every point.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <SiteNav user={user} />
        {children}
      </body>
    </html>
  );
}
