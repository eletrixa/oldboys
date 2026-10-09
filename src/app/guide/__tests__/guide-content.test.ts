/**
 * Tests for the /guide content: research words only, numbers from the domain constants, UI labels still in the app.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/guide/__tests__/guide-content.test.ts
 * Deps:    vitest, node:fs, ../guide-content, src/domain/audit, src/domain/run-status
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Wording: no verdict words; a sentence about scores or ranking is a negative one
 * - Numbers: retention days, the start cap and the stalled minutes appear as the constants say
 * - Label drift: every literal bold label exists verbatim in a src/app source file outside src/app/guide
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETENTION_DAYS } from "@/domain/audit";
import { START_PER_HOUR_CAP, STALLED_AFTER_MINUTES } from "@/domain/run-status";
import { allText, literalLabels } from "../guide-content";

const text = allText();

describe("guide wording", () => {
  it("has no verdict words", () => {
    expect(text.filter((t) => /good fit|bad fit|recommend|red flag|suitable|unsuitable/i.test(t))).toEqual([]);
  });

  it("only mentions scores or ranking to say Radar does not", () => {
    const sentences = text.flatMap((t) => t.split(/(?<=[.!?:;])\s+/));
    const bad = sentences.filter((s) => /\b(scores?|rank(s|ed|ing)?)\b/i.test(s) && !/\b(never|not)\b/i.test(s));
    expect(bad).toEqual([]);
  });
});

describe("guide numbers", () => {
  it("uses the domain constants", () => {
    const all = text.join("\n");
    expect(all).toContain(`${String(RETENTION_DAYS)} days`);
    expect(all).toContain(String(START_PER_HOUR_CAP));
    expect(all).toContain(`${String(STALLED_AFTER_MINUTES)} minutes`);
  });
});

describe("guide labels", () => {
  const files = (readdirSync("src/app", { recursive: true, encoding: "utf8" }))
    .filter((f) => /\.tsx?$/.test(f) && !f.split(/[\\/]/).includes("guide") && !f.includes("__tests__"))
    .map((f) => join("src/app", f));
  const source = files
    .map((f) => readFileSync(f, "utf8"))
    .join("\n")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");

  it("reads the app sources", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(literalLabels())("%s exists in the app", (label) => {
    expect(source.includes(label)).toBe(true);
  });
});
