/**
 * Site navigation for the Radar header: links depend on whether a recruiter is logged in.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/site-nav.tsx
 * Deps:    next/link, @/domain/session (SessionUser type), ./logout-button, ./nav-menu
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Logged out: landing anchors (The brief, How it works, Trust, FAQ; md and up), Log in, Create account, always on one row beside the mark. Logged in: My briefs and New brief (secondary, "New" under sm) at every width; Positions, Roles, organization name and Log out inline from md, in the "Menu" overflow under md; one row at 390px
 *
 * Design constraints:
 * - Server component; rendered inside the layout's header next to the Radar mark
 * - Radar tokens only (docs/design/radar-ui.md)
 */
import Link from "next/link";
import type { SessionUser } from "@/domain/session";
import { LogoutButton } from "./logout-button";
import { NavLink } from "./nav-link";
import { NavMenu } from "./nav-menu";
import { BTN_QUIET, BTN_SECONDARY } from "./ui";

/** Landing section anchors for logged-out visitors; hidden on phones where the header has room for the two actions only. */
const ANCHOR = BTN_QUIET.replace("inline-flex", "hidden md:inline-flex");

export function SiteNav({ user }: { user: SessionUser | null }): React.JSX.Element {
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {user === null ? (
        <>
          <Link href="/#product" className={ANCHOR}>The brief</Link>
          <Link href="/#how" className={ANCHOR}>How it works</Link>
          <Link href="/#trust" className={ANCHOR}>Trust</Link>
          <Link href="/#faq" className={ANCHOR}>FAQ</Link>
          <NavLink href="/login">Log in</NavLink>
          <Link href="/register" className={BTN_SECONDARY}>Create account</Link>
        </>
      ) : (
        <>
          <span className="hidden md:contents">
            <NavLink href="/positions">Positions</NavLink>
            <NavLink href="/roles">Roles</NavLink>
          </span>
          <NavLink href="/briefs">My briefs</NavLink>
          <span className="hidden px-2 text-sm text-muted md:inline">{user.organizationName}</span>
          <span className="hidden md:contents">
            <LogoutButton />
          </span>
          <Link href="/briefs/new" className={BTN_SECONDARY}>
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New brief</span>
          </Link>
          <NavMenu>
            <NavLink href="/positions">Positions</NavLink>
            <NavLink href="/roles">Roles</NavLink>
            <span className="truncate px-3 py-1 text-sm text-muted">{user.organizationName}</span>
            <LogoutButton />
          </NavMenu>
        </>
      )}
    </nav>
  );
}
