/**
 * Radar header and footer, hidden on candidate-facing routes (/apply/<tag>) so applicants never see operator navigation.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/site-chrome.tsx
 * Deps:    next/link, next/navigation
 * Tested:  n/a (QA in the browser; see docs/ops/intake.md)
 *
 * Key responsibilities:
 * - SiteHeader: Echo r mark + wordmark and the nav the layout passes in (SiteNav, a server component)
 * - SiteFooter: the short honesty line and a link to /validation (what is real, simulated, incomplete)
 * - Both render nothing under /apply/<tag> (plans/008: the candidate sees "received", never the research product)
 *
 * Design constraints:
 * - Client component only because usePathname needs it; no state, no fetches; the nav arrives as a prop so the
 *   session-aware SiteNav stays a server component
 * - The Echo r mark is concept artwork from the Radar design work, not a cleared trademark
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function EchoMark({ size }: Readonly<{ size: number }>): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M14 56V30a16 16 0 0 1 16-16" stroke="#282d2b" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M38 8a26 26 0 0 1 18 18" stroke="#a44732" strokeWidth={6} strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Candidate pages live at /apply/<tag>; bare /apply has no page.
const isCandidateRoute = (pathname: string | null): boolean => pathname?.startsWith("/apply/") ?? false;

export function SiteHeader({ nav }: Readonly<{ nav: React.ReactNode }>): React.JSX.Element | null {
  if (isCandidateRoute(usePathname())) return null;
  return (
    <header className="border-b border-divider bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
        <Link href="/" aria-label="Radar home" className="flex min-h-11 items-center gap-2.5">
          <EchoMark size={28} />
          <span className="font-serif text-[26px] leading-none font-semibold tracking-tight">radar</span>
        </Link>
        {nav}
      </div>
    </header>
  );
}

export function SiteFooter(): React.JSX.Element | null {
  if (isCandidateRoute(usePathname())) return null;
  return (
    <footer className="border-t border-divider">
      <p className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted">
        Radar prepares evidence and never scores people. A person makes every decision.{" "}
        <Link href="/validation" className="underline decoration-muted/40 underline-offset-4 hover:text-ink">What is real, simulated or unfinished</Link>
      </p>
    </footer>
  );
}
