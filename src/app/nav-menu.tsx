/**
 * Phone overflow menu for the logged-in header: Positions, Roles, organization and Log out under md.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/nav-menu.tsx
 * Deps:    next/navigation, ./ui
 * Tested:  n/a (rendering only)
 *
 * Key responsibilities:
 * - A `details` disclosure ("Menu", 44px target) that closes when the page changes (remounted by pathname)
 *
 * Design constraints:
 * - Client component; children are server-rendered by site-nav; hidden from md up where the links sit inline
 */
"use client";

import { usePathname } from "next/navigation";
import { SUMMARY } from "./ui";

export function NavMenu({ children }: { children: React.ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  return (
    <details key={pathname} className="group relative md:hidden">
      <summary aria-label="Menu" className={`${SUMMARY} justify-center px-3`}>Menu</summary>
      <div className="absolute right-0 top-full z-20 mt-1 flex w-52 flex-col gap-1 rounded-2xl border border-divider bg-surface p-2 shadow-lg">
        {children}
      </div>
    </details>
  );
}
