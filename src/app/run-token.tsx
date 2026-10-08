/**
 * Operator token (RUN_TOKEN) kept in sessionStorage, and the form that asks for it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/run-token.tsx
 * Deps:    react
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
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Team access token
        <input
          name="token"
          type="password"
          required
          autoComplete="off"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 focus:border-teal-400 focus:outline-none"
        />
        <span className="text-xs font-normal text-zinc-400">{hint}</span>
      </label>
      {error !== null && <p className="text-sm text-red-300">{error}</p>}
      <button type="submit" className="self-start rounded-xl bg-teal-500 px-4 py-2 font-medium text-zinc-950 hover:bg-teal-400">
        {submitLabel}
      </button>
    </form>
  );
}
