/**
 * Same-site `next` path for the login redirect.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/login/next-path.ts
 * Deps:    none
 * Tested:  src/app/login/__tests__/next-path.test.ts
 *
 * Key responsibilities:
 * - safeNext: the path (with query) when it stays on this site, else "/"
 * - loginHref: /login with an encoded `next`, or plain /login when next is "/"
 *
 * Design constraints:
 * - Pure; rejects absolute URLs, protocol-relative paths and backslash tricks so login cannot redirect off site
 */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 500) return "/";
  try {
    const u = new URL(raw, "http://local.invalid");
    return u.origin === "http://local.invalid" ? `${u.pathname}${u.search}` : "/";
  } catch {
    return "/";
  }
}

export function loginHref(next: string): string {
  const n = safeNext(next);
  return n === "/" ? "/login" : `/login?next=${encodeURIComponent(n)}`;
}
