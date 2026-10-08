/**
 * Operator token for the bearer-protected list pages (/roles, /intake): storage, form and the gated fetch.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_lib/operator-token.tsx
 * Deps:    react (types only), sessionStorage
 * Tested:  n/a (browser glue, exercised by the QA pass)
 *
 * Key responsibilities:
 * - readToken / writeToken: the RUN_TOKEN in sessionStorage under one key, tolerant of blocked storage
 * - TokenForm: the "Team access token" prompt, with the page's own helper line and button label; stores the typed token on submit (a 401 on the follow-up fetch clears it)
 * - fetchGated: GET a bearer-protected JSON route; a 401 clears the stored token and asks again
 * - authHeaders: the Authorization header for follow-up writes on the same page
 *
 * Design constraints:
 * - Client-side only; the token never leaves sessionStorage except as the Authorization header
 * - Without a stored token no request goes out: the token form is returned straight away
 */
"use client";

const TOKEN_KEY = "oldboys.runToken";

/** State of a token-gated page load; `loading` is the caller's initial value. */
export type Gated<T> =
  | { kind: "loading" }
  | { kind: "token"; error: string | null }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: T };

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

export function authHeaders(token: string | null): Record<string, string> {
  return token === null ? {} : { Authorization: `Bearer ${token}` };
}

/** GET `path` with the token; `what` names the thing in the error copy ("the roles"). */
export async function fetchGated<T>(path: string, token: string | null, what: string): Promise<Gated<T>> {
  // No token yet: ask for one instead of provoking a 401 in the console on every first visit.
  if (token === null) return { kind: "token", error: null };
  try {
    const res = await fetch(path, { headers: authHeaders(token), cache: "no-store" });
    if (res.status === 401) {
      writeToken(null);
      return { kind: "token", error: "That token did not work. Please try again." };
    }
    if (!res.ok) return { kind: "error", message: `We could not load ${what}. Please try again.` };
    const data = await res.json<T>();
    return { kind: "ready", data };
  } catch {
    return { kind: "error", message: "We could not reach the service. Please try again." };
  }
}

type TokenFormProps = { error: string | null; helper: string; button: string; onSubmit: (token: string) => void };

export function TokenForm({ error, helper, button, onSubmit }: TokenFormProps): React.JSX.Element {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const raw = new FormData(e.currentTarget).get("token");
        if (typeof raw !== "string" || raw.trim() === "") return;
        writeToken(raw.trim());
        onSubmit(raw.trim());
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
        <span className="text-xs font-normal text-zinc-400">{helper}</span>
      </label>
      {error !== null && <p className="text-sm text-red-300">{error}</p>}
      <button type="submit" className="self-start rounded-xl bg-teal-500 px-4 py-2 font-medium text-zinc-950 hover:bg-teal-400">
        {button}
      </button>
    </form>
  );
}
