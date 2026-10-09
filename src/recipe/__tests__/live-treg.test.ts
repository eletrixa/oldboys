/**
 * Live smoke of the treg collectors: real adapter, real endpoints, a few cents of balance.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/live-treg.test.ts
 * Deps:    vitest, src/adapters/treg, src/recipe/runner, src/recipe/sources/treg/*
 * Tested:  n/a (LIVE=1 TREG_TOKEN=… pnpm exec vitest run live-treg)
 *
 * Key responsibilities:
 * - Skipped unless LIVE=1 and TREG_TOKEN is set; runs each treg collector with public, well-known accounts and prints
 *   every excerpt, note and cost so a provider's real response shape is checked against the parser
 * - Fails when a 2xx payload parses to no source (a shape the parser does not read); for Apollo, a person record with no other
 *   account listed rightly yields no source, so the test asserts the person itself and names any platform the social read missed
 *
 * Design constraints:
 * - Spends real balance (≈ $0.05 per run); never part of `pnpm check`
 */
import { describe, expect, it } from "vitest";
import { makeTregCall } from "@/adapters/treg";
import type { Candidate } from "@/domain/claim";
import { collectWith } from "@/recipe/runner";
import { tregCompanyEnrich } from "@/recipe/sources/treg/company-enrich";
import { tregPeopleSearch } from "@/recipe/sources/treg/people-search";
import { tregPersonEnrich } from "@/recipe/sources/treg/person-enrich";
import { tregSocialVerify } from "@/recipe/sources/treg/social-verify";
import type { Collector, StepContext, StepOutcome } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";
import { baseContext, fakePorts } from "./fakes";

const token = process.env.TREG_TOKEN ?? "";
const live = process.env.LIVE === "1" && token !== "";
const step = { id: "live", actor: "live" } as unknown as Step;

const cand = (platform: string, handle: string | null, url: string): Candidate => ({
  id: `c-${platform}`, run_id: "run-live", name: "Robert Vojáček", profile_urls: [url], anchor_match: null, score: 0.95,
  decision: "merge", platform, handle, snippet: "", reasons: [],
});

async function run(collector: Collector, ctx: StepContext): Promise<StepOutcome> {
  const ports = fakePorts({ callTreg: makeTregCall(token), newId: () => crypto.randomUUID(), now: () => new Date().toISOString() });
  const out = await collectWith(collector, step, ctx, ports);
  process.stdout.write(`\n== ${collector.id}: ${String(out.sources.length)} sources, $${out.cost_usd.toFixed(4)}\n`);
  for (const s of out.sources) process.stdout.write(`  ${s.url}\n    ${s.excerpt.replace(/\n/g, "\n    ")}\n`);
  for (const n of out.notes) process.stdout.write(`  note: ${n}\n`);
  if (out.digest !== undefined && out.digest !== null) process.stdout.write(`  digest: ${JSON.stringify(out.digest).slice(0, 600)}\n`);
  return out;
}

describe.skipIf(!live)("live treg collectors (LIVE=1 TREG_TOKEN=…)", () => {
  it("person-enrich reads Apollo for the confirmed LinkedIn profile (one source per other account it lists)", async () => {
    const li = process.env.LINKEDIN ?? "https://www.linkedin.com/in/rvojacek/";
    const ctx = baseContext({ subject: "Robert Vojáček", anchor: "Praha", candidates: [cand("linkedin", "rvojacek", li)] });
    const [req] = tregPersonEnrich.requests(ctx, step);
    if (req?.via !== "treg") throw new Error("no treg request");
    const { payload, cost_usd } = await makeTregCall(token)(req);
    const person = (payload as { person?: { name?: string; twitter_url?: string | null; github_url?: string | null; facebook_url?: string | null } }).person;
    const sources = tregPersonEnrich.parse(payload, ctx, step, req);
    process.stdout.write(`\n== ${tregPersonEnrich.id}: person ${person?.name ?? "(none)"}, ${String(sources.length)} sources, $${cost_usd.toFixed(4)}\n`);
    for (const s of sources) process.stdout.write(`  ${s.url}\n    ${s.excerpt.replace(/\n/g, "\n    ")}\n`);
    expect(person?.name).toBeTruthy(); // the shape still has a person; a profile with no other accounts rightly yields no source
    const listed = [person?.twitter_url, person?.github_url, person?.facebook_url].filter((u) => typeof u === "string" && u !== "").length;
    expect(sources.length > 0 || listed === 0).toBe(true);
  }, 60_000);

  it("people-search finds LinkedIn profiles for a name and anchor", async () => {
    const out = await run(tregPeopleSearch, baseContext({ subject: "Robert Vojáček", anchor: "Groupon", candidates: [] }));
    expect(out.notes.filter((n) => /HTTP|invalid JSON/.test(n))).toEqual([]);
    expect(out.sources.length).toBeGreaterThan(0);
  }, 60_000);

  it("social-verify reads one public account per platform", async () => {
    const all = [
      cand("linkedin", "rvojacek", "https://www.linkedin.com/in/rvojacek/"),
      cand("instagram", "natgeo", "https://www.instagram.com/natgeo/"),
      cand("tiktok", "khaby.lame", "https://www.tiktok.com/@khaby.lame"),
      cand("x", "github", "https://x.com/github"),
      cand("youtube", "mkbhd", "https://www.youtube.com/@mkbhd"),
      cand("facebook", null, "https://www.facebook.com/zuck"),
    ];
    const out = await run(tregSocialVerify, baseContext({ candidates: all }));
    expect(out.notes.filter((n) => /HTTP|invalid JSON/.test(n))).toEqual([]);
    const missing = all.map((c) => c.platform).filter((p) => !out.sources.some((s) => s.url.includes(p === "x" ? "x.com" : p)));
    expect(missing).toEqual([]);
  }, 120_000);

  it("company-enrich reads the anchor domain", async () => {
    const out = await run(tregCompanyEnrich, baseContext({ goal: "due-diligence", subject: "Groupon", anchor: "groupon.com", candidates: [] }));
    expect(out.notes.filter((n) => /HTTP|invalid JSON/.test(n))).toEqual([]);
    expect(out.sources).toHaveLength(1);
  }, 60_000);
});
