/**
 * Tests for the shared ledger digest reader.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/ledger-digest.test.ts
 * Deps:    vitest, zod, src/domain/ledger-digest
 * Tested:  n/a
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readDigest, readDigests } from "@/domain/ledger-digest";

const Num = z.number();
const row = (step: string, ref: unknown): { step: string; ref_json: string } => ({ step, ref_json: JSON.stringify(ref) });

describe("readDigest", () => {
  it("returns the newest digest of the step that parses", () => {
    const rows = [row("a", { digest: 1 }), row("a", { digest: 2 }), row("a", { digest: "bad" })];
    expect(readDigest(rows, "a", Num)).toBe(2);
  });

  it("is null when the step is absent or nothing parses", () => {
    expect(readDigest([row("b", { digest: 1 })], "a", Num)).toBeNull();
    expect(readDigest([row("a", { digest: "x" }), { step: "a", ref_json: "{" }], "a", Num)).toBeNull();
  });
});

describe("readDigests", () => {
  it("keeps first-appearance order and the newest parsing digest per step", () => {
    const rows = [row("seed", { digest: 1 }), row("x", { digest: 2 }), row("seed", { digest: 3 }), row("x", { digest: "bad" })];
    expect([...readDigests(rows, Num)]).toEqual([["seed", 3], ["x", 2]]);
  });

  it("skips rows without a digest, malformed JSON and null columns", () => {
    const rows = [row("a", { note: "n" }), { step: "b", ref_json: "{digest" }, { step: null, ref_json: '{"digest":1}' }, { step: "c", ref_json: null }];
    expect(readDigests(rows, Num).size).toBe(0);
  });
});
