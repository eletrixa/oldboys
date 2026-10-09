/**
 * Tests for the seed seam (plans/006): profile URL and CV become the merged identity, failures degrade to notes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/seed.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - seedProfile: profile ok, profile fails, CV ok, CV model fails, same ids on a retry
 * - linkedin_profile does not scrape a profile the seed already fetched
 * - lineupNeedsAnswer: a seed merge means no "who is it?" pause
 *
 * Design constraints:
 * - Fake ports only; no network
 */
import { describe, expect, it } from "vitest";
import { Source } from "@/domain/claim";
import type { Ports } from "@/domain/ports";
import { executeStep } from "@/recipe/runner";
import { lineupNeedsAnswer } from "@/recipe/seams/resolve";
import { seedProfile, type SeedInput } from "@/recipe/seams/seed";
import { baseContext, fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const URL_IN = "https://www.linkedin.com/in/josef-buryan";
const input = (over: Partial<SeedInput> = {}): SeedInput => ({ runId: "run-1", subject: "", anchor: "", profileUrl: URL_IN, cvText: null, ...over });

const profileItem = {
  linkedinUrl: "https://www.linkedin.com/in/josef-buryan",
  firstName: "Josef",
  lastName: "Buryan",
  headline: "CMO at Groupon",
  location: { linkedinText: "Prague, Czechia" },
  experience: [{ position: "Chief Marketing Officer", companyName: "Groupon", startDate: "2023" }],
};

/** storeSource that validates against the domain schema, as the D1 adapter does. */
const strictStore: Ports["storeSource"] = (s) => Promise.resolve(Source.parse({ ...s, r2_key: `${s.run_id}/${s.id}.json` }));

describe("seedProfile with a LinkedIn profile URL", () => {
  it("scrapes it once, stores a merged source, merges the candidate and derives subject + anchor", async () => {
    const ports = fakePorts({ callActor: () => Promise.resolve({ items: [profileItem], cost_usd: 0.004 }), storeSource: strictStore });
    const r = await seedProfile(input(), ports);
    expect(ports.calls.actor).toEqual(["harvestapi/linkedin-profile-scraper"]);
    expect(r.subject).toBe("Josef Buryan");
    expect(r.anchor).toBe("Prague, Czechia");
    expect(r.headline).toBe("CMO at Groupon");
    expect(r.employer).toBe("Groupon");
    expect(r.actor).toEqual({ calls: 1, cost_usd: 0.004 });
    expect(r.out.sources).toHaveLength(1);
    expect(r.out.sources[0]).toMatchObject({ identity: "merged", actor: "harvestapi/linkedin-profile-scraper", url: URL_IN });
    expect(r.out.candidates).toEqual([
      expect.objectContaining({ platform: "linkedin", handle: "josef-buryan", profile_urls: [URL_IN], decision: "merge", score: 1, reasons: ["profile given by the manager"], name: "Josef Buryan" }),
    ]);
    expect(r.out.notes).toEqual([]);
    expect(r.out.digest).toEqual([expect.objectContaining({ platform: "linkedin", handle: "josef-buryan", display_name: "Josef Buryan", earliest_experience_year: 2023 })]);
  });

  it("does not fail when the actor throws: name from the handle, anchor = profile URL, candidate still merged", async () => {
    const ports = fakePorts({ callActor: () => Promise.reject(new Error("timeout 45s")) });
    const r = await seedProfile(input(), ports);
    expect(r.subject).toBe("Josef Buryan");
    expect(r.anchor).toBe(URL_IN);
    expect(r.out.sources).toEqual([]);
    expect(r.out.candidates[0]).toMatchObject({ decision: "merge", profile_urls: [URL_IN] });
    expect(r.out.notes[0]).toMatch(/profile scrape failed \(timeout 45s\)/);
    expect(r.actor.calls).toBe(1);
  });

  it("keeps a given subject when the scrape returns nothing usable", async () => {
    const ports = fakePorts({ callActor: () => Promise.resolve({ items: [{ nope: 1 }], cost_usd: 0.001 }) });
    const r = await seedProfile(input({ subject: "Josef Buryan Sr.", anchor: "Praha" }), ports);
    expect(r.subject).toBe("Josef Buryan Sr.");
    expect(r.anchor).toBe(URL_IN);
    expect(r.out.notes[0]).toMatch(/no profile/);
  });
});

const CV = `Josef Buryan
Chief Marketing Officer, Groupon — Prague
github.com/jburyan · https://www.linkedin.com/in/josef-buryan-cv
Experience: Groupon 2023–present`;

describe("seedProfile with a pasted CV", () => {
  it("stores the CV as a merged source and merges only the profile links written in it", async () => {
    const ports = fakePorts({
      storeSource: strictStore,
      llm: fakeLlm(() => ({
        full_name: "Josef Buryan",
        headline: "Chief Marketing Officer, Groupon",
        location: "Prague",
        current_employer: "Groupon",
        links: ["github.com/jburyan", "https://www.linkedin.com/in/josef-buryan-cv", "https://x.com/invented"],
      })),
    });
    const r = await seedProfile(input({ profileUrl: null, cvText: CV }), ports);
    expect(ports.calls.actor).toEqual([]);
    expect(ports.calls.llm).toEqual(["primary"]);
    expect(r.subject).toBe("Josef Buryan");
    expect(r.anchor).toBe("Prague");
    expect(r.llm.calls).toBe(1);
    expect(r.out.sources).toEqual([expect.objectContaining({ actor: "cv", url: "cv:run-1", identity: "merged", excerpt: CV })]);
    expect(r.out.candidates.map((c) => [c.platform, c.handle, c.decision])).toEqual([
      ["github", "jburyan", "merge"],
      ["linkedin", "josef-buryan-cv", "merge"],
    ]);
  });

  it("is idempotent: a second run with the same input yields the same source and candidate ids", async () => {
    const cvFacts = () => ({ full_name: "Josef Buryan", headline: "", location: "", current_employer: "", links: ["github.com/jburyan"] });
    const run = () =>
      seedProfile(
        input({ cvText: CV }),
        fakePorts({ storeSource: strictStore, callActor: () => Promise.resolve({ items: [profileItem], cost_usd: 0.004 }), llm: fakeLlm(cvFacts) }),
      );
    const [a, b] = [await run(), await run()];
    const ids = (r: typeof a) => [...r.out.sources.map((s) => s.id), ...r.out.candidates.map((c) => c.id)];
    expect(ids(a)).toHaveLength(4);
    expect(new Set(ids(a)).size).toBe(4);
    expect(ids(b)).toEqual(ids(a));
    expect((await seedProfile(input({ runId: "run-2", cvText: CV }), fakePorts({ llm: fakeLlm(cvFacts) }))).out.sources.map((s) => s.id)).not.toContain(a.out.sources[1]?.id);
  });

  it("keeps the run going when the model fails: CV source stored, no name, a note", async () => {
    const ports = fakePorts();
    const r = await seedProfile(input({ profileUrl: null, cvText: CV }), ports);
    expect(r.subject).toBe("");
    expect(r.anchor).toBe("");
    expect(r.out.candidates).toEqual([]);
    expect(r.out.sources).toHaveLength(1);
    expect(r.llm.calls).toBe(0);
    expect(r.out.notes[0]).toMatch(/CV reading failed/);
  });
});

describe("linkedin_profile after the seed", () => {
  const step = { id: "linkedin_profile", kind: "actor" as const, actor: "harvestapi/linkedin-profile-scraper" };

  it("returns the seed's source without a request instead of scraping the same URL again", async () => {
    const seeded = await seedProfile(input(), fakePorts({ callActor: () => Promise.resolve({ items: [profileItem], cost_usd: 0.004 }) }));
    const ctx = baseContext({ candidates: seeded.out.candidates, sources: seeded.out.sources });
    const ports = fakePorts();
    const out = await executeStep(step, ctx, ports);
    expect(ports.calls.actor).toEqual([]);
    expect(out.empty).toBe(false);
    expect(out.calls).toBe(0);
    expect(out.sources).toEqual(seeded.out.sources);
    expect(out.notes).toEqual(["already fetched at seed"]);
  });

  it("still scrapes when the seed scrape failed", async () => {
    const seeded = await seedProfile(input(), fakePorts({ callActor: () => Promise.reject(new Error("down")) }));
    const ports = fakePorts();
    await executeStep(step, baseContext({ candidates: seeded.out.candidates }), ports);
    expect(ports.calls.actor).toEqual(["harvestapi/linkedin-profile-scraper"]);
  });
});

describe("lineupNeedsAnswer", () => {
  it("does not ask when the seed merged a profile and the SERP added nothing open", () => {
    expect(lineupNeedsAnswer([{ decision: "merge" }, { decision: "rejected" }])).toBe(false);
  });

  it("never asks for a possibly-same-as next to a seed merge", () => {
    expect(lineupNeedsAnswer([{ decision: "merge" }, { decision: "possibly-same-as" }])).toBe(false);
  });

  it("asks only when candidates exist and none is merged", () => {
    expect(lineupNeedsAnswer([{ decision: "possibly-same-as" }])).toBe(true);
    expect(lineupNeedsAnswer([{ decision: "rejected" }])).toBe(true);
    expect(lineupNeedsAnswer([])).toBe(false);
  });
});
