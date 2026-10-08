/**
 * Header navigation link that marks the current page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/nav-link.tsx
 * Deps:    next/link, next/navigation, ./ui
 * Tested:  n/a (visual)
 *
 * Key responsibilities:
 * - aria-current="page" and ink text when the pathname starts with the link's href (exact match for "/")
 *
 * Design constraints:
 * - Client component because usePathname; the layout stays a server component
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BTN_SECONDARY } from "./ui";

/** BTN_QUIET without its colour so the current page can carry ink + semibold without a class clash. */
const QUIET_BASE = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors hover:bg-sage/60 hover:text-ink active:bg-sage";

export function NavLink({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }): React.JSX.Element {
  const pathname = usePathname();
  const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const quiet = current ? `${QUIET_BASE} font-semibold text-ink underline decoration-action decoration-2 underline-offset-8` : `${QUIET_BASE} font-medium text-muted`;
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={secondary ? BTN_SECONDARY : quiet}>
      {children}
    </Link>
  );
}
