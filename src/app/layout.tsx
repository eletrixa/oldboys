/**
 * Root layout: document shell, Radar header and footer, global styles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/layout.tsx
 * Deps:    next, tailwindcss
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Metadata and the <html>/<body> wrapper for every page
 * - Radar brand header (Echo r mark + wordmark, New brief, Roles) and a short honesty footer
 *
 * Design constraints:
 * - No runtime = "edge"; no next/font network fetch at build (fonts are self-hosted in public/fonts)
 * - The Echo r mark is concept artwork from the Radar design work, not a cleared trademark
 */
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radar — evidence-led research",
  description: "Role and profile in; a brief where every claim links to its source.",
};

function EchoMark({ size }: Readonly<{ size: number }>): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M14 56V30a16 16 0 0 1 16-16" stroke="#282d2b" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M38 8a26 26 0 0 1 18 18" stroke="#a44732" strokeWidth={6} strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-canvas text-ink antialiased">
        <header className="border-b border-divider bg-canvas/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" aria-label="Radar home" className="flex min-h-11 items-center gap-2.5">
              <EchoMark size={28} />
              <span className="font-serif text-[26px] leading-none font-semibold tracking-tight">radar</span>
            </Link>
            <nav aria-label="Main" className="flex items-center gap-1">
              <Link href="/roles" className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-sage hover:text-ink">
                Roles
              </Link>
              <Link href="/" className="flex min-h-11 items-center rounded-lg bg-action px-4 text-sm font-semibold text-white hover:bg-action-hover">
                New brief
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-divider">
          <p className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted">
            Radar prepares evidence and never scores people. A person makes every decision. Hackathon prototype.
          </p>
        </footer>
      </body>
    </html>
  );
}
