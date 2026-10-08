/**
 * Tests for ElevenLabs webhook signature parsing and verification.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/elevenlabs-signature.test.ts
 * Deps:    vitest, node:crypto
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Expected HMAC is computed independently with node:crypto
 * - Cover valid, tampered, wrong secret, stale, future, malformed and wrong-length cases
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SIGNATURE_TOLERANCE_SECS,
  parseSignatureHeader,
  verifyElevenLabsSignature,
} from "@/domain/elevenlabs-signature";

const secret = "wsec_test";
const rawBody = '{"type":"post_call_transcription","data":{"conversation_id":"c1"}}';
const now = 1_800_000_000;

function sign(t: number, body = rawBody, key = secret): string {
  return createHmac("sha256", key).update(`${String(t)}.${body}`).digest("hex");
}

function check(header: string | null, over: Partial<{ rawBody: string; secret: string }> = {}): Promise<boolean> {
  return verifyElevenLabsSignature({ rawBody, secret, ...over, header, nowSecs: now });
}

describe("parseSignatureHeader", () => {
  it("parses in any order", () => {
    expect(parseSignatureHeader("t=12,v0=ab")).toEqual({ t: 12, v0: "ab" });
    expect(parseSignatureHeader("v0=ab, t=12")).toEqual({ t: 12, v0: "ab" });
  });

  it("rejects malformed headers", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader("t=12")).toBeNull();
    expect(parseSignatureHeader("v0=ab")).toBeNull();
    expect(parseSignatureHeader("t=abc,v0=ab")).toBeNull();
    expect(parseSignatureHeader("garbage")).toBeNull();
  });
});

describe("verifyElevenLabsSignature", () => {
  it("accepts a valid signature", async () => {
    expect(await check(`t=${String(now)},v0=${sign(now)}`)).toBe(true);
  });

  it("accepts a timestamp exactly at the tolerance edge", async () => {
    const t = now - SIGNATURE_TOLERANCE_SECS;
    expect(await check(`t=${String(t)},v0=${sign(t)}`)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    expect(await check(`t=${String(now)},v0=${sign(now)}`, { rawBody: rawBody + " " })).toBe(false);
  });

  it("rejects the wrong secret", async () => {
    expect(await check(`t=${String(now)},v0=${sign(now, rawBody, "other")}`)).toBe(false);
  });

  it("rejects a stale timestamp (31 minutes)", async () => {
    const t = now - 31 * 60;
    expect(await check(`t=${String(t)},v0=${sign(t)}`)).toBe(false);
  });

  it("rejects a future timestamp beyond tolerance", async () => {
    const t = now + 31 * 60;
    expect(await check(`t=${String(t)},v0=${sign(t)}`)).toBe(false);
  });

  it("rejects malformed headers", async () => {
    expect(await check(null)).toBe(false);
    expect(await check(`t=${String(now)}`)).toBe(false);
    expect(await check(`t=abc,v0=${sign(now)}`)).toBe(false);
  });

  it("rejects hex of a different length", async () => {
    expect(await check(`t=${String(now)},v0=${sign(now).slice(0, 62)}`)).toBe(false);
    expect(await check(`t=${String(now)},v0=${sign(now)}00`)).toBe(false);
  });
});
