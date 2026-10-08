/**
 * Verify the `ElevenLabs-Signature` header of a post-call webhook (HMAC-SHA256 over `${t}.${body}`).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/elevenlabs-signature.ts
 * Deps:    WebCrypto (`crypto.subtle`), no imports
 * Tested:  src/domain/__tests__/elevenlabs-signature.test.ts
 *
 * Key responsibilities:
 * - Parse `t=<unix>,v0=<hex>` in any order
 * - Recompute the HMAC over the raw body, compare in constant time, enforce the timestamp tolerance
 *
 * Design constraints:
 * - Pure: no I/O, no node: imports; the caller passes the clock (`nowSecs`)
 * - Never throws on bad input; any problem returns false / null
 */

import { timingSafeEqual } from "@/domain/timing-safe-equal";

export const SIGNATURE_TOLERANCE_SECS = 30 * 60;

export function parseSignatureHeader(header: string | null): { t: number; v0: string } | null {
  if (header === null) return null;
  let t: number | null = null;
  let v0: string | null = null;
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) t = Number(value);
    else if (key === "v0" && value.length > 0) v0 = value;
  }
  return t === null || v0 === null ? null : { t, v0 };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyElevenLabsSignature(input: {
  rawBody: string;
  header: string | null;
  secret: string;
  nowSecs: number;
}): Promise<boolean> {
  try {
    const parsed = parseSignatureHeader(input.header);
    if (parsed === null) return false;
    if (Math.abs(input.nowSecs - parsed.t) > SIGNATURE_TOLERANCE_SECS) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(input.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${String(parsed.t)}.${input.rawBody}`));
    return timingSafeEqual(toHex(new Uint8Array(sig)), parsed.v0.toLowerCase());
  } catch {
    return false;
  }
}
