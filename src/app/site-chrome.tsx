/**
 * Radar header and footer, hidden on candidate-facing routes (/apply) so applicants never see operator navigation.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/site-chrome.tsx
 * Deps:    next/link, next/navigation
 * Tested:  n/a (QA in the browser; see docs/ops/intake.md)
 *
 * Key responsibilities:
 * - SiteHeader: Echo r mark + wordmark, Roles, Applications, New brief
 * - SiteFooter: the short honesty line
 * - Both render nothing under /apply (plans/008: the candidate sees "received", never the research product)
 *
 * Design constraints:
 * - Client component only because usePathname needs it; no state, no fetches
 * - The Echo r mark is concept artwork from the Radar design work, not a cleared trademark
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const CANDIDATE_PREFIX = "/apply";

function EchoMark({ size }: Readonly<{ size: number }>): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M14 56V30a16 16 0 0 1 16-16" stroke="#282d2b" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M38 8a26 26 0 0 1 18 18" stroke="#a44732" strokeWidth={6} strokeLinecap="round" fill="none" />
    </svg>
  );
}

function isCandidateRoute(pathname: string | null): boolean {
  return pathname !== null && (pathname === CANDIDATE_PREFIX || pathname.startsWith(`${CANDIDATE_PREFIX}/`));
}

export function SiteHeader(): React.JSX.Element | null {
  if (isCandidateRoute(usePathname())) return null;
  return (
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
          <Link href="/intake" className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-sage hover:text-ink">
            Applications
          </Link>
          <Link href="/" className="flex min-h-11 items-center rounded-lg bg-action px-4 text-sm font-semibold text-white hover:bg-action-hover">
            New brief
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter(): React.JSX.Element | null {
  if (isCandidateRoute(usePathname())) return null;
  return (
    <footer className="border-t border-divider">
      <p className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted">
        Radar prepares evidence and never scores people. A person makes every decision. Hackathon prototype.
      </p>
    </footer>
  );
}
