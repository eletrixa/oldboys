/**
 * Root layout: document shell, Radar header and footer, global styles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/layout.tsx
 * Deps:    next, tailwindcss, ./site-chrome
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Metadata and the <html>/<body> wrapper for every page
 * - Radar brand header and honesty footer via SiteHeader/SiteFooter (hidden on the candidate-facing /apply routes)
 *
 * Design constraints:
 * - No runtime = "edge"; no next/font network fetch at build (fonts are self-hosted in public/fonts)
 */
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "./site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar — evidence-led research",
  description: "Role and profile in; a brief where every claim links to its source.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-canvas text-ink antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
