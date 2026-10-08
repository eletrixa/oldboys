/**
 * Current session user for server components and route handlers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/current-user.ts
 * Deps:    next/headers, react (cache), @opennextjs/cloudflare
 * Tested:  src/app/api/auth/__tests__/auth.test.ts
 *
 * Key responsibilities:
 * - currentUser() reads the session cookie via next/headers; request-scoped cache() so layout and page share one D1 lookup
 *
 * Design constraints:
 * - The only auth file importing next/headers so handlers stay testable in Node
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, type SessionUser } from "@/domain/session";
import { loadSession } from "./session";

export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined || token === "") return null;
  return loadSession(getCloudflareContext().env.DB, token, new Date());
});
