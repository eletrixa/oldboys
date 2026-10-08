/**
 * Hex digests shared by the intake connectors and the ElevenLabs signature check.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/digest.ts
 * Deps:    WebCrypto (crypto.subtle), TextEncoder
 * Tested:  src/domain/__tests__/digest.test.ts
 *
 * Key responsibilities:
 * - toHex: bytes to lowercase hex
 * - sha256Hex: SHA-256 of a string or buffer as hex (stable external ids: apply page, mail without Message-ID)
 *
 * Design constraints:
 * - Pure; runs under Workers and Node without imports
 */

export function toHex(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}
