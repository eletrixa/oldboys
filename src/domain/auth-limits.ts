/**
 * Auth rate-limit constants and helpers shared by the auth and ARES routes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/auth-limits.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/auth-limits.test.ts
 *
 * Key responsibilities:
 * - Window sizes and caps for register, failed login and ARES lookups
 * - since(): ISO lower bound of a window; clientIp(): CF-Connecting-IP
 *
 * Design constraints:
 * - Counters live in D1 auth_attempts; this file holds no state
 */
export type AttemptKind = "register" | "login_fail" | "ares";

export const REGISTER_PER_HOUR_PER_IP = 10;
export const ARES_PER_HOUR_PER_IP = 30;
export const LOGIN_FAILS_PER_WINDOW = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const ATTEMPT_RETENTION_MS = 24 * HOUR_MS;

export function since(now: Date, windowMs: number): string {
  return new Date(now.getTime() - windowMs).toISOString();
}

export function clientIp(headers: Headers): string {
  const ip = headers.get("CF-Connecting-IP")?.trim() ?? "";
  return ip === "" ? "unknown" : ip;
}
