/**
 * Root layout: document shell, Radar header and footer, global styles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/layout.tsx
 * Deps:    next, tailwindcss, ./site-chrome, ./site-nav, ./api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Metadata (title, description, Open Graph image public/marketing/og.jpg) and the <html>/<body> wrapper for every page
 * - Radar brand header (Echo r mark + wordmark, SiteNav: Positions, Roles, Applications, New brief as a secondary button so each page keeps one rust action)
 *   and a short honesty footer via SiteHeader/SiteFooter, both hidden on the candidate-facing /apply routes
 *
 * Design constraints:
 * - No runtime = "edge"; no next/font network fetch at build (fonts are self-hosted in public/fonts)
 */
import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "./api/_lib/current-user";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { SiteNav } from "./site-nav";

const DESCRIPTION = "Radar reads a candidate's public professional work and hands you one page: what a source backs up, what is still open, and the questions worth asking.";

export const metadata: Metadata = {
  metadataBase: new URL("https://oldboys.asajj.cz"),
  title: "Radar — walk into every interview knowing what to ask",
  description: DESCRIPTION,
  openGraph: { title: "Radar", description: DESCRIPTION, images: [{ url: "/marketing/og.jpg", width: 1200, height: 630 }] },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const user = await currentUser();
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-canvas text-ink antialiased">
        <SiteHeader nav={<SiteNav user={user} />} />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
