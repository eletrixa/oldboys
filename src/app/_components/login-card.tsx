/**
 * "Log in" prompt card shown by pages whose data needs a session.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/login-card.tsx
 * Deps:    next/link, next/navigation, src/app/login/next-path, src/app/ui
 * Tested:  n/a (covered by e2e/positions.spec.ts and the roles page)
 *
 * Key responsibilities:
 * - Title, one line of copy, "Log in" button (returns to this page via `next`) and "Create an account" link
 * - Optional children render below, e.g. the "use the team token" link
 *
 * Design constraints:
 * - Client component; `next` is the current path unless given
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginHref } from "@/app/login/next-path";
import { BTN_PRIMARY, CARD, LINK } from "@/app/ui";

type LoginCardProps = { title: string; body: string; next?: string; children?: React.ReactNode };

export function LoginCard({ title, body, next, children }: LoginCardProps): React.JSX.Element {
  const pathname = usePathname();
  return (
    <div className={`${CARD} flex w-full max-w-md flex-col items-start gap-3`}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      <div className="flex items-center gap-4">
        <Link href={loginHref(next ?? pathname)} className={BTN_PRIMARY}>Log in</Link>
        <Link href="/register" className={`${LINK} text-sm`}>Create an account</Link>
      </div>
      {children}
    </div>
  );
}
