/**
 * Site navigation for the Radar header: links depend on whether a recruiter is logged in.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/site-nav.tsx
 * Deps:    next/link, @/domain/session (SessionUser type), ./logout-button
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Logged out: landing anchors (Product, How it works, Trust; md and up), Log in, Create account, always on one row beside the mark. Logged in: Positions, Roles, Applications, My briefs, organization name, Log out, New brief (primary)
 *
 * Design constraints:
 * - Server component; rendered inside the layout's header next to the Radar mark
 * - Radar tokens only (docs/design/radar-ui.md)
 */
import Link from "next/link";
import type { SessionUser } from "@/domain/session";
import { LogoutButton } from "./logout-button";
import { NavLink } from "./nav-link";
import { BTN_QUIET, BTN_SECONDARY } from "./ui";

/** Landing section anchors for logged-out visitors; hidden on phones where the header has room for the two actions only. */
const ANCHOR = BTN_QUIET.replace("inline-flex", "hidden md:inline-flex");

export function SiteNav({ user }: { user: SessionUser | null }): React.JSX.Element {
  return (
    <nav aria-label="Main" className={user === null ? "flex items-center gap-1" : "flex w-full flex-wrap items-center gap-1 sm:w-auto sm:justify-end"}>
      {user === null ? (
        <>
          <Link href="/#product" className={ANCHOR}>Product</Link>
          <Link href="/#how" className={ANCHOR}>How it works</Link>
          <Link href="/#trust" className={ANCHOR}>Trust</Link>
          <NavLink href="/login">Log in</NavLink>
          <Link href="/register" className={BTN_SECONDARY}>Create account</Link>
        </>
      ) : (
        <>
          <NavLink href="/positions">Positions</NavLink>
          <NavLink href="/roles">Roles</NavLink>
          <NavLink href="/intake">Applications</NavLink>
          <NavLink href="/briefs">My briefs</NavLink>
          <span className="hidden px-2 text-sm text-muted md:inline">{user.organizationName}</span>
          <LogoutButton />
          <Link href="/briefs/new" className={`${BTN_SECONDARY} hidden sm:inline-flex`}>New brief</Link>
        </>
      )}
    </nav>
  );
}
