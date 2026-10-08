/**
 * Non-ready states of a team-shared page: loading, log in (token form as a secondary link), error, not found.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/auth-states.tsx
 * Deps:    next/link, react, ./{login-card,token-form,use-authed-json}, ../ui
 * Tested:  n/a (covered by e2e/positions.spec.ts and the roles page)
 *
 * Key responsibilities:
 * - AuthStates renders whatever is not "ready"; returns null when ready
 * - LoginOrToken: the log-in card with "Use the team token instead" revealing the token form
 *
 * Design constraints:
 * - Client component; copy is plain and states what to do next
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { CARD_SAGE, LINK } from "../ui";
import { LoginCard } from "./login-card";
import { TokenForm } from "./token-form";
import type { AuthedLoad } from "./use-authed-json";

type AuthStatesProps = {
  state: AuthedLoad<unknown>;
  onToken: (token: string) => void;
  hint: string;
  submitLabel: string;
  /** Where a 404 sends the reader back to. */
  back?: { label: string; href: string };
};

type TokenProps = { onToken: (token: string) => void; hint: string; submitLabel: string; error?: string | null };

/** Log-in card for session users; operators without an account open the token form from the secondary link. */
export function LoginOrToken({ onToken, hint, submitLabel, error = null, title = "Log in to see positions", body = "Positions are shared by your team. Log in to see them." }: TokenProps & { title?: string; body?: string }): React.JSX.Element {
  const [token, setToken] = useState(error !== null);
  return (
    <LoginCard title={title} body={body}>
      {token ? (
        <TokenForm error={error} onSubmit={onToken} hint={hint} submitLabel={submitLabel} />
      ) : (
        <button type="button" className={`${LINK} text-sm`} onClick={() => { setToken(true); }}>Use the team token instead</button>
      )}
    </LoginCard>
  );
}

export function AuthStates({ state, onToken, hint, submitLabel, back }: AuthStatesProps): React.JSX.Element | null {
  switch (state.kind) {
    case "loading":
      return (
        <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-3">
          <div className="h-8 w-1/3 rounded bg-divider" />
          <div className="h-4 w-1/2 rounded bg-divider" />
        </div>
      );
    case "login":
      return <LoginOrToken onToken={onToken} hint={hint} submitLabel={submitLabel} />;
    case "token":
      return <TokenForm error={state.error} onSubmit={onToken} hint={hint} submitLabel={submitLabel} />;
    case "notfound":
      return (
        <div className={`${CARD_SAGE} flex flex-col items-start gap-2`}>
          <h2 className="font-serif text-2xl">Not found</h2>
          {back !== undefined && <Link href={back.href} className={LINK}>{back.label}</Link>}
        </div>
      );
    case "error":
      return <p role="alert" className="text-conflict">{state.message}</p>;
    case "ready":
      return null;
  }
}
