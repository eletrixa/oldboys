/**
 * Session token, hash and cookie helpers for recruiter logins.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/session.ts
 * Deps:    WebCrypto (globalThis.crypto), src/domain/password (toBase64)
 * Tested:  src/domain/__tests__/session.test.ts
 *
 * Key responsibilities:
 * - Mint 43-char base64url tokens; only their SHA-256 hex is stored in D1
 * - Build and read the `oldboys_session` cookie
 *
 * Design constraints:
 * - Workers-safe: no Buffer
 * - Cookie is HttpOnly, SameSite=Lax, Path=/; Secure only on https
 */
import { toBase64 } from "@/domain/password";

export const SESSION_COOKIE = "oldboys_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  sessionId: string;
  accountId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
};

export function newSessionToken(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sessionExpiresAt(now: Date): string {
  return new Date(now.getTime() + SESSION_TTL_MS).toISOString();
}

function cookie(value: string, maxAgeSecs: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(maxAgeSecs)}${secure ? "; Secure" : ""}`;
}

export function sessionCookie(token: string, opts: { secure: boolean }): string {
  return cookie(token, SESSION_TTL_MS / 1000, opts.secure);
}

export function clearSessionCookie(opts: { secure: boolean }): string {
  return cookie("", 0, opts.secure);
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  if (cookieHeader === null) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) {
      const value = part.slice(eq + 1).trim();
      return value === "" ? null : value;
    }
  }
  return null;
}
