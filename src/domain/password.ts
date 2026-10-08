/**
 * Password hashing with WebCrypto PBKDF2-SHA256.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/password.ts
 * Deps:    WebCrypto (globalThis.crypto.subtle), src/domain/timing-safe-equal
 * Tested:  src/domain/__tests__/password.test.ts
 *
 * Key responsibilities:
 * - hashPassword: random 16-byte salt, stored as `pbkdf2$<iterations>$<salt b64>$<hash b64>`
 * - verifyPassword: constant-time compare; malformed input is false, never an exception
 *
 * Design constraints:
 * - Workers-safe: no Buffer, no node:crypto
 * - The stored iteration count must equal PBKDF2_ITERATIONS (Workers caps PBKDF2 cost)
 */
import { timingSafeEqual } from "@/domain/timing-safe-equal";

export const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS,
  );
  return toBase64(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return `pbkdf2$${String(PBKDF2_ITERATIONS)}$${toBase64(salt)}$${await derive(password, salt, PBKDF2_ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterations, saltB64, hashB64, ...rest] = stored.split("$");
    if (scheme !== "pbkdf2" || iterations !== String(PBKDF2_ITERATIONS)) return false;
    if (saltB64 === undefined || hashB64 === undefined || rest.length > 0) return false;
    const actual = await derive(password, fromBase64(saltB64), PBKDF2_ITERATIONS);
    return timingSafeEqual(actual, hashB64);
  } catch {
    return false;
  }
}
