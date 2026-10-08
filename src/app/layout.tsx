/**
 * Root layout: document shell, Radar header and footer, global styles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/layout.tsx
 * Deps:    next, tailwindcss, ./site-chrome, ./site-nav, ./api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Metadata and the <html>/<body> wrapper for every page
 * - Radar brand header (Echo r mark + wordmark, SiteNav) and a short honesty footer via SiteHeader/SiteFooter, both
 *   hidden on the candidate-facing /apply routes
 *
 * Design constraints:
 * - No runtime = "edge"; no next/font network fetch at build (fonts are self-hosted in public/fonts)
 */
import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "./api/_lib/current-user";
import { SiteFooter, SiteHeader } from "./site-chrome";
import { SiteNav } from "./site-nav";

export const metadata: Metadata = {
  title: "Radar — evidence-led research",
  description: "Role and profile in; a brief where every claim links to its source.",
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
