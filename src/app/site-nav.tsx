/**
 * Site navigation for the Radar header: links depend on whether a recruiter is logged in.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/site-nav.tsx
 * Deps:    next/link, @/domain/session (SessionUser type), ./logout-button
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Logged out: Log in, Create account. Logged in: Roles, My briefs, organization name, Log out, New brief (primary)
 *
 * Design constraints:
 * - Server component; rendered inside the layout's header next to the Radar mark
 * - Radar tokens only (docs/design/radar-ui.md)
 */
import Link from "next/link";
import type { SessionUser } from "@/domain/session";
import { LogoutButton } from "./logout-button";

const QUIET = "flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted hover:bg-sage hover:text-ink";
const PRIMARY = "flex min-h-11 items-center rounded-lg bg-action px-4 text-sm font-semibold text-white hover:bg-action-hover";

export function SiteNav({ user }: { user: SessionUser | null }): React.JSX.Element {
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-end gap-1">
      {user === null ? (
        <>
          <Link href="/login" className={QUIET}>Log in</Link>
          <Link href="/register" className={PRIMARY}>Create account</Link>
        </>
      ) : (
        <>
          <Link href="/roles" className={QUIET}>Roles</Link>
          <Link href="/briefs" className={QUIET}>My briefs</Link>
          <span className="hidden px-2 text-sm text-muted md:inline">{user.organizationName}</span>
          <LogoutButton />
          <Link href="/" className={PRIMARY}>New brief</Link>
        </>
      )}
    </nav>
  );
}
