/**
 * Operator token (RUN_TOKEN) kept in sessionStorage, and the form that asks for it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/run-token.tsx
 * Deps:    react, src/app/ui (Radar vocabulary)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - readToken / writeToken: one sessionStorage key for every operator view (roles overview, phone verification)
 * - TokenForm: password field; the caller decides the hint and the button label
 *
 * Design constraints:
 * - Client only; the token never leaves sessionStorage except as the Authorization header
 * - Storage may be blocked: reads return null, writes are dropped (the user is asked again)
 */
"use client";

import { BTN_PRIMARY, FIELD } from "./ui";

export const TOKEN_KEY = "oldboys.runToken";

export function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token === null) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked: the user is asked again next time.
  }
}

export function TokenForm({
  error,
  hint,
  submitLabel,
  onSubmit,
}: {
  error: string | null;
  hint: string;
  submitLabel: string;
  onSubmit: (token: string) => void;
}): React.JSX.Element {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const raw = new FormData(e.currentTarget).get("token");
        if (typeof raw === "string" && raw.trim() !== "") onSubmit(raw.trim());
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="team-token" className="text-sm font-semibold">
          Team access token
        </label>
        <input
          id="team-token"
          name="token"
          type="password"
          required
          autoComplete="off"
          aria-describedby="team-token-help"
          aria-invalid={error !== null}
          className={FIELD}
        />
        <span id="team-token-help" className="text-xs text-muted">{hint}</span>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-conflict">
          {error}
        </p>
      )}
      <button type="submit" className={`${BTN_PRIMARY} self-start`}>
        {submitLabel}
      </button>
    </form>
  );
}
