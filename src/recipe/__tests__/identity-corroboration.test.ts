/**
 * Identity after the lineup, rule 2 (name + employer corroboration), plus the resolve merge cap and reasons hygiene.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/identity-corroboration.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Candidate, Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { MERGE_FLOOR, resolveCandidates, sourceIdentityUpdates, UNCORROBORATED_CAP } from "@/recipe/seams/resolve";
import { alsoFoundOf, evidenceOf } from "@/recipe/seams/synthesize";
import { experienceCompanies, HARVEST_ACTOR } from "@/recipe/sources/linkedin";
import { baseContext, fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const SERP = "apify/google-search-scraper";
const src = (id: string, url: string, excerpt: string, identity: Source["identity"] = "unverified", actor = SERP): Source => ({
  id, run_id: "run-1", url, actor, fetched_at: "t", excerpt, r2_key: "k", expires_at: "e", identity,
});
const cand = (url: string, decision: Candidate["decision"]): Candidate => ({
  id: url, run_id: "run-1", name: "Josef Buryan", profile_urls: [url], anchor_match: null, score: 1, decision, platform: "linkedin", handle: null, snippet: "", reasons: [],
});

const LI = "https://www.linkedin.com/in/josef-buryan";
const profile = src(
  "li",
  LI,
  "Josef Buryan\nCMO, Groupon (NASDAQ: GRPN) | ex-Meta\nPrague, Czechia\nCurrent: Chief Marketing Officer @ Groupon\nChief Marketing Officer @ Groupon (Feb 2025–Present)\nHead of Growth @ Vilgain (2021–2023)\nMarketing Lead @ Meta (2016–2021)",
  "merged",
  HARVEST_ACTOR,
);
const saatchi = src("saatchi", "https://mcsaatchi.com/news/groupon-turn-life-on", "M+C Saatchi Group | Groupon Turn Life On\n“People aren't choosing the couch over real life,” said Josef Buryan, Chief Marketing Officer at Groupon.");
const team = src("team", "https://www.groupon.com/articles/team", "Team | About Groupon\nChief Marketing Officer. Josef Buryan is a seasoned marketing executive.");
const dentist = src("dentist", "https://zubari-brno.cz/tym", "Josef Buryan, dentist in Brno");
const employerOnly = src("emp", "https://news.example.com/groupon", "Groupon launches Turn Life On with M+C Saatchi");
const accent = src("accent", "https://cz.example.com/a", "Rozhovor: Josef Buryán (Vilgain) o růstu");
const reversed = src("rev", "https://example.org/speakers", "Speakers: Buryan Josef, Groupon");
const rejectedHit = src("rej", "https://www.linkedin.com/in/josef-buryan-dentist", "Josef Buryan - Groupon voucher dentist");
const cands = [cand(LI, "merge"), cand("https://www.linkedin.com/in/josef-buryan-dentist", "rejected")];
const all = [profile, saatchi, team, dentist, employerOnly, accent, reversed, rejectedHit];

const apply = (sources: readonly Source[]): Source[] => {
  const next = new Map(sourceIdentityUpdates(cands, sources, { subject: "Josef Buryan", orgs: ["Groupon"] }).map((u) => [u.id, u.identity]));
  return sources.map((s) => ({ ...s, identity: next.get(s.id) ?? s.identity }));
};

describe("experienceCompanies", () => {
  it("parses harvest experience lines and the apimaestro Current line", () => {
    expect(experienceCompanies(profile.excerpt)).toEqual(["Groupon", "Vilgain", "Meta"]);
    expect(experienceCompanies("Jana\nCurrent: Kiwi.com\nEngineer @ Kiwi.com (2020–present)")).toEqual(["Kiwi.com"]);
  });
});

describe("name + employer corroboration (rule 2)", () => {
  const updates = sourceIdentityUpdates(cands, all, { subject: "Josef Buryan", orgs: ["Groupon"] });
  const byId = new Map(updates.map((u) => [u.id, u]));

  it("merges the Saatchi quote and the team page with a recorded reason", () => {
    expect(byId.get("saatchi")).toEqual({ id: "saatchi", identity: "merged", reason: "name and employer match (Groupon)" });
    expect(byId.get("team")?.reason).toBe("name and employer match (Groupon)");
  });
  it("merges diacritics and reversed order, with a past employer from the LinkedIn experience lines", () => {
    expect(byId.get("accent")?.reason).toBe("name and employer match (Vilgain)");
    expect(byId.get("rev")?.identity).toBe("merged");
  });
  it("leaves the namesake, the employer-only page and a rejected profile unverified", () => {
    expect(byId.has("dentist")).toBe(false);
    expect(byId.has("emp")).toBe(false);
    expect(byId.has("rej")).toBe(false);
  });
  it("is idempotent and changes nothing without corroboration input", () => {
    expect(sourceIdentityUpdates(cands, apply(all), { subject: "Josef Buryan", orgs: ["Groupon"] })).toEqual([]);
    expect(sourceIdentityUpdates(cands, all).filter((u) => u.reason !== null)).toEqual([]);
  });
  it("never corroborates without a subject or organisation", () => {
    expect(sourceIdentityUpdates([], [saatchi], { subject: "", orgs: ["Groupon"] })).toEqual([]);
    expect(sourceIdentityUpdates([], [saatchi], { subject: "Josef Buryan", orgs: [] })).toEqual([]);
  });
  it("corroborated sources become evidence; also_found keeps only unverified pages that name the surname", () => {
    const ctx = baseContext({ subject: "Josef Buryan", anchor: "Prague, Czechia", sources: apply(all), candidates: cands });
    expect(evidenceOf(ctx).map((e) => e.url)).toEqual(expect.arrayContaining([saatchi.url, team.url, accent.url, reversed.url]));
    // the employer-only page never names him, so it is noise rather than a namesake and is not listed
    expect(alsoFoundOf(ctx).map((e) => e.url)).toEqual([dentist.url]);
  });
});

describe("resolve merge cap and reasons hygiene", () => {
  const hits = [
    src("ig", "https://www.instagram.com/josefburyan/", "Josef Buryan (@josefburyan) • Instagram\nDad, Rugby Addict"),
    src("x", "https://x.com/josefburyan", "Josef Buryan (@josefburyan) / X\nCMO in Prague"),
    src("fb", "https://www.facebook.com/josefburyan", "Josef Buryan | Facebook\nWorks at Groupon"),
  ];
  const ctx = baseContext({ subject: "Josef Buryan", anchor: "Prague, Czechia", sources: [profile, ...hits], candidates: [cand(LI, "merge")] });
  const scoreAll = fakeLlm((prompt) =>
    [...prompt.matchAll(/id=(id-\d+) platform=(\w+)/g)].map((m) => ({
      id: m[1] ?? "",
      score: 0.85,
      reasons: m[2] === "instagram" ? ["Handle matches name", "Prague check-ins on 31 Jan and 1 Feb 2025", "Profile-picture updates"] : m[2] === "x" ? ["Location matches"] : ["Name matches"],
    })),
  );

  it("caps a handle-only model merge at possibly-same-as; location or employer keeps the merge", async () => {
    const out = await resolveCandidates(ctx, fakePorts({ llm: scoreAll }));
    const by = new Map(out.candidates.map((c) => [c.platform, c]));
    expect(by.get("instagram")?.decision).toBe("possibly-same-as");
    expect(by.get("instagram")?.score).toBe(UNCORROBORATED_CAP);
    expect(UNCORROBORATED_CAP).toBeLessThan(MERGE_FLOOR);
    expect(by.get("x")?.decision).toBe("merge");
    expect(by.get("facebook")?.decision).toBe("merge");
  });

  it("sets anchor_match when the location matched, and keeps personal details out of reasons and snippets", async () => {
    const out = await resolveCandidates(ctx, fakePorts({ llm: scoreAll }));
    const by = new Map(out.candidates.map((c) => [c.platform, c]));
    expect(by.get("x")?.anchor_match).toBe("Prague, Czechia");
    const ig = by.get("instagram");
    expect(ig?.reasons.join(" ")).not.toMatch(/check-in|profile-picture/i);
    expect(ig?.reasons).toContain("Handle matches name");
    expect(ig?.snippet).not.toMatch(/Dad|Rugby/);
  });

  it("never sets anchor_match to an empty anchor, even when the model says the location matched", async () => {
    const out = await resolveCandidates({ ...ctx, anchor: "" }, fakePorts({ llm: scoreAll }));
    expect(out.candidates.map((c) => c.anchor_match)).toEqual([null, null, null]);
  });

  it("tells the model the merge rule and the professional-only reasons rule", async () => {
    let system = "";
    const llm = ((input: { system: string; prompt: string }) => {
      system = input.system;
      return Promise.resolve({ value: [], cost_usd: 0 });
    }) as Ports["llm"];
    await resolveCandidates(ctx, fakePorts({ llm }));
    expect(system).toContain("A name or handle match alone is at most 0.7");
    expect(system).toMatch(/Never mention personal-life details/);
  });
});
