/**
 * Operator token helpers shared by the client pages that call bearer-protected routes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/token.ts
 * Deps:    browser sessionStorage, fetch
 * Tested:  n/a (browser storage; covered by e2e/positions.spec.ts)
 *
 * Key responsibilities:
 * - readToken / writeToken: the RUN_TOKEN kept in sessionStorage under oldboys.runToken
 * - authFetch: no-store fetch that adds the Authorization header when a token is present
 * - OPERATOR_KEY / clearOperator: the operator name the call form remembers (call-setup.tsx), cleared on logout
 *
 * Design constraints:
 * - The token never leaves sessionStorage except as the Authorization header
 * - Storage may be blocked: reads give null, writes are ignored
 */
const TOKEN_KEY = "oldboys.runToken";
export const OPERATOR_KEY = "oldboys.operator";

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

export function clearOperator(): void {
  try {
    sessionStorage.removeItem(OPERATOR_KEY);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

/** JSON POST with the stored operator token (if any) as the bearer; cookies travel as on every fetch. */
export function postJson(path: string, body: unknown): Promise<Response> {
  return authFetch(path, readToken(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function authFetch(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, cache: "no-store" });
}
