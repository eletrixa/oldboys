/**
 * Non-ready states of a bearer-protected page: loading, token form, error, not found.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/auth-states.tsx
 * Deps:    next/link, src/app/_components/token-form, ./use-authed-json
 * Tested:  n/a (covered by e2e/positions.spec.ts)
 *
 * Key responsibilities:
 * - AuthStates renders whatever is not "ready"; returns null when ready
 *
 * Design constraints:
 * - Client component; copy is plain and states what to do next
 */
"use client";

import Link from "next/link";
import { TokenForm } from "@/app/_components/token-form";
import type { AuthedLoad } from "./use-authed-json";

type AuthStatesProps = { state: AuthedLoad<unknown>; onToken: (token: string) => void };

export function AuthStates({ state, onToken }: AuthStatesProps): React.JSX.Element | null {
  switch (state.kind) {
    case "loading":
      return <p className="text-zinc-400">Loading…</p>;
    case "token":
      return <TokenForm error={state.error} onSubmit={onToken} hint="Positions are shared by the team, so they need the team token. Kept only in this tab." submitLabel="Show positions" />;
    case "notfound":
      return (
        <div className="flex flex-col gap-2">
          <p className="font-medium">Position not found</p>
          <Link href="/positions" className="text-sm text-teal-300 underline-offset-2 hover:underline">All positions</Link>
        </div>
      );
    case "error":
      return <p role="alert" className="text-red-300">{state.message}</p>;
    case "ready":
      return null;
  }
}
