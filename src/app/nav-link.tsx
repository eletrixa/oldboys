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
import { BTN_QUIET, BTN_SECONDARY } from "./ui";

export function NavLink({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }): React.JSX.Element {
  const pathname = usePathname();
  const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const base = secondary ? BTN_SECONDARY : BTN_QUIET;
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={`${base} ${current && !secondary ? "font-semibold text-ink" : ""}`}>
      {children}
    </Link>
  );
}
