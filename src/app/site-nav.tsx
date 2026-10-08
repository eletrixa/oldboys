/**
 * Site header: logo plus links for a logged-in or logged-out visitor.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/site-nav.tsx
 * Deps:    next/link, ./logout-button, src/domain/session (type)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Logged in: New brief, My briefs, Roles, organization name, log out; logged out: Log in, Create account
 *
 * Design constraints:
 * - Server component; receives the user from the layout, never reads cookies itself
 */
import Link from "next/link";
import type { SessionUser } from "@/domain/session";
import { LogoutButton } from "./logout-button";

const LINK = "text-sm text-zinc-400 hover:text-zinc-200";

export function SiteNav({ user }: { user: SessionUser | null }): React.JSX.Element {
  return (
    <header className="border-b border-zinc-800">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-teal-500 text-xs text-zinc-950">CB</span>
          Candidate Brief
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {user === null ? (
            <>
              <Link href="/login" className={LINK}>Log in</Link>
              <Link href="/register" className={LINK}>Create account</Link>
            </>
          ) : (
            <>
              <Link href="/" className={LINK}>New brief</Link>
              <Link href="/briefs" className={LINK}>My briefs</Link>
              <Link href="/roles" className={LINK}>Roles</Link>
              <span className="text-sm text-zinc-500">{user.organizationName}</span>
              <LogoutButton />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
