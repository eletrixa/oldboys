/**
 * Tests for the profile-signal rules: one firing fixture per rule, an all-quiet fixture, namesake handling, wording screen.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/profile-signals.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Candidate } from "@/domain/claim";
import { JUDGEMENT } from "@/domain/challenge";
import type { CodeProfile } from "@/domain/code-profile";
import { facts as makeFacts, type ProfileFacts } from "@/domain/profile-facts";
import { LINKEDIN_CREATION_NOTE, mergeAccounts, PROFILE_SIGNAL_CAVEATS, profileSignals, type ProfileSignalsInput } from "@/domain/profile-signals";

const NOW = "2026-10-09T10:00:00.000Z";
const BANNED = /cheat|plagiar|steal|mislead|misrepresent|pretend|deceiv|exaggerat|bogus|scam|fake|suspicious|fraud/i;

const facts = (platform: string, over: Partial<ProfileFacts> = {}): ProfileFacts => ({
  ...makeFacts(platform, `https://${platform}.example/me`, { source_url: `https://${platform}.example/me.json` }),
  ...over,
});

const code = (over: Partial<CodeProfile> = {}): CodeProfile =>
  ({ handle: "me", profile_url: "https://github.com/me", repos_owned: 10, forks_excluded: 2, sources: { user: "https://api.github.com/users/me", repos: "https://api.github.com/users/me/repos", search: "https://api.github.com/search/issues", events: "https://api.github.com/users/me/events/public", orgs: "https://api.github.com/users/me/orgs" }, ...over }) as CodeProfile;

const cand = (over: Partial<Candidate>): Candidate => ({
  id: "c1",
  run_id: "r1",
  name: "Jan Novak",
  profile_urls: ["https://x.com/jn"],
  anchor_match: null,
  score: 0.9,
  decision: "merge",
  platform: "x",
  handle: null,
  snippet: "",
  reasons: [],
  ...over,
});

const run = (over: Partial<ProfileSignalsInput>): ReturnType<typeof profileSignals> =>
  profileSignals({ facts: [], codeProfile: null, candidates: [], now: NOW, ...over });
const ids = (r: ReturnType<typeof profileSignals>): string[] => r.signals.map((s) => s.id);

const HEADLINE = "Chief Marketing Officer at Acme building growth teams in Prague";

const fixtures: ProfileSignalsInput[] = [];
const track = (r: ReturnType<typeof profileSignals>): ReturnType<typeof profileSignals> => {
  r.signals.forEach((s) => fixtures.push({ facts: [], codeProfile: null, candidates: [], now: s.text + "\n" + (s.ask ?? "") }));
  return r;
};

describe("profileSignals", () => {
  it("fires young-account for an account created within 180 days", () => {
    const r = track(run({ facts: [facts("x", { created_at: "2026-08-14T10:00:00.000Z" })] }));
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0]).toMatchObject({
      id: "young-account",
      platform: "x",
      text: "The X account was created on 2026-08-14.",
      ask: "Your X account was created on 2026-08-14. Is it your only account there?",
      source_url: "https://x.example/me.json",
    });
  });

  it("does not fire young-account for an older account or a future date", () => {
    expect(run({ facts: [facts("x", { created_at: "2026-01-01" })] }).signals).toEqual([]);
    expect(run({ facts: [facts("x", { created_at: "2027-01-01" })] }).signals).toEqual([]);
  });

  it("reads a lenient platform date string", () => {
    const r = run({ facts: [facts("instagram", { created_at: "Sat Aug 14 2026" })] });
    expect(r.signals[0]?.text).toBe("The Instagram account was created on 2026-08-14.");
  });

  it("says 'in {year}' when created_at only has a year, counted from 1 January (never younger than it can be)", () => {
    expect(run({ facts: [facts("github", { created_at: "2026" })] }).signals).toEqual([]);
    const r = run({ facts: [facts("github", { created_at: "2026" }), facts("linkedin", { earliest_experience_year: 2012 })] });
    expect(r.signals[0]?.text).toBe("The GitHub account dates from 2026; the confirmed LinkedIn profile lists roles since 2012.");
    expect(r.signals[0]?.ask).toBe("Your GitHub account was created in 2026. Is it your only account there?");
  });

  it("ignores an unparseable created_at", () => {
    expect(run({ facts: [facts("x", { created_at: "long ago" })] }).signals).toEqual([]);
  });

  it("fires account-vs-career instead of young-account when LinkedIn lists old roles", () => {
    const r = track(
      run({
        facts: [facts("linkedin", { earliest_experience_year: 2014 }), facts("x", { created_at: "2026-03-01" })],
      }),
    );
    expect(ids(r)).toEqual(["account-vs-career"]);
    expect(r.signals[0]?.text).toBe("The X account dates from 2026-03-01; the confirmed LinkedIn profile lists roles since 2014.");
    expect(r.signals[0]?.ask).toBe("Your X account was created on 2026-03-01. Is it your only account there?");
  });

  it("keeps young-account when the career is short", () => {
    const r = run({ facts: [facts("linkedin", { earliest_experience_year: 2024 }), facts("x", { created_at: "2026-08-01" })] });
    expect(ids(r)).toEqual(["young-account"]);
  });

  it("fires follow-asymmetry on following >= 500 and >= 10x followers, with followers 0", () => {
    const r = track(run({ facts: [facts("instagram", { followers: 0, following: 1500 })] }));
    expect(r.signals[0]).toMatchObject({ id: "follow-asymmetry", text: "Instagram: 0 followers, follows 1 500.", ask: null });
  });

  it("does not fire follow-asymmetry below the thresholds", () => {
    expect(run({ facts: [facts("x", { followers: 10, following: 499 })] }).signals).toEqual([]);
    expect(run({ facts: [facts("x", { followers: 100, following: 900 })] }).signals).toEqual([]);
    expect(run({ facts: [facts("x", { followers: null, following: 900 })] }).signals).toEqual([]);
  });

  it("fires forks-only with the GitHub source and profile", () => {
    const r = track(run({ codeProfile: code({ repos_owned: 10, forks_excluded: 8 }) }));
    expect(r.signals[0]).toMatchObject({
      id: "forks-only",
      platform: "github",
      profile_url: "https://github.com/me",
      source_url: "https://api.github.com/users/me/repos",
      text: "GitHub: 8 of 10 public repositories are forks.",
      ask: "Which of your GitHub repositories is your own work?",
    });
  });

  it("links the repos listing as the forks-only source and needs at least 5 repositories", () => {
    expect(run({ codeProfile: code({ repos_owned: 5, forks_excluded: 4 }) }).signals[0]?.source_url).toBe("https://api.github.com/users/me/repos");
    expect(run({ codeProfile: code({ repos_owned: 4, forks_excluded: 4 }) }).signals).toEqual([]);
  });

  it("fires linkedin-verified only on true", () => {
    const r = track(run({ facts: [facts("linkedin", { verified: true })] }));
    expect(r.signals[0]).toMatchObject({ id: "linkedin-verified", text: "LinkedIn shows the verified badge on this profile.", ask: null });
    expect(run({ facts: [facts("linkedin", { verified: false })] }).signals).toEqual([]);
  });

  it("fires few-connections only with a long listed career", () => {
    const r = track(run({ facts: [facts("linkedin", { connections: 12, earliest_experience_year: 2010 })] }));
    expect(r.signals[0]).toMatchObject({ id: "few-connections", text: "LinkedIn: 12 connections; roles listed since 2010.", ask: null });
    expect(run({ facts: [facts("linkedin", { connections: 12, earliest_experience_year: 2024 })] }).signals).toEqual([]);
    expect(run({ facts: [facts("linkedin", { connections: 12 })] }).signals).toEqual([]);
  });

  it("fires same-headline for a non-merged candidate with a near-identical long headline", () => {
    const r = track(
      run({
        facts: [facts("linkedin", { bio: HEADLINE })],
        candidates: [cand({ decision: "possibly-same-as", platform: "x", snippet: HEADLINE, profile_urls: ["https://x.com/other"] })],
      }),
    );
    expect(r.signals[0]).toMatchObject({
      id: "same-headline",
      platform: "x",
      profile_url: "https://x.com/other",
      source_url: "https://x.com/other",
      text: "A namesake profile on X carries the same headline text as the confirmed profile.",
      ask: null,
    });
  });

  it("takes the headline from the merged LinkedIn candidate when no LinkedIn bio exists", () => {
    const r = run({
      candidates: [
        cand({ id: "a", platform: "linkedin", snippet: HEADLINE, profile_urls: ["https://linkedin.com/in/me"] }),
        cand({ id: "b", decision: "rejected", platform: "github", snippet: HEADLINE, profile_urls: ["https://github.com/other"] }),
      ],
    });
    expect(ids(r)).toEqual(["same-headline"]);
    expect(r.signals[0]?.text).toContain("GitHub");
  });

  it("does not fire same-headline for a short snippet or a merged candidate", () => {
    const short = "Marketing director Prague";
    expect(
      run({ facts: [facts("linkedin", { bio: short })], candidates: [cand({ decision: "possibly-same-as", snippet: short })] }).signals,
    ).toEqual([]);
    expect(run({ facts: [facts("linkedin", { bio: HEADLINE })], candidates: [cand({ snippet: HEADLINE })] }).signals).toEqual([]);
  });

  it("is quiet for ordinary accounts", () => {
    const r = run({
      facts: [
        facts("x", { created_at: "2019-05-01", followers: 120, following: 300 }),
        facts("linkedin", { connections: 400, earliest_experience_year: 2012, verified: null }),
      ],
      codeProfile: code({ repos_owned: 10, forks_excluded: 2 }),
    });
    expect(r.signals).toEqual([]);
    expect(r.not_checked).toEqual([LINKEDIN_CREATION_NOTE]);
    expect(r.checked).toEqual(["x", "linkedin"]);
  });

  it("drops the LinkedIn creation note once a second read gave the creation month", () => {
    const r = run({ facts: [facts("linkedin", { created_at: "2013-04", connections: 400, earliest_experience_year: 2012, verified: null })] });
    expect(r.not_checked).toEqual([]);
    expect(r.signals).toEqual([]);
  });

  it("puts signals with an ask before context, stable by rule order", () => {
    const r = run({
      facts: [facts("linkedin", { verified: true }), facts("x", { created_at: "2026-09-01", followers: 1, following: 800 })],
      codeProfile: code({ repos_owned: 6, forks_excluded: 6 }),
    });
    expect(ids(r)).toEqual(["young-account", "forks-only", "linkedin-verified", "follow-asymmetry"]);
  });

  it("lists merged platforms without facts as not read", () => {
    const r = run({
      facts: [facts("x")],
      candidates: [
        cand({ id: "1", platform: "x" }),
        cand({ id: "2", platform: "github" }),
        cand({ id: "3", platform: "instagram", decision: "rejected" }),
        cand({ id: "4", platform: "tiktok" }),
      ],
    });
    expect(r.not_checked).toEqual([LINKEDIN_CREATION_NOTE, "TikTok: account details were not read on this run.", "GitHub: account details were not read on this run."]);
  });

  it("keeps every sentence free of verdict words", () => {
    const wide = track(
      run({
        facts: [
          facts("linkedin", { verified: true, connections: 3, earliest_experience_year: 2008, bio: HEADLINE }),
          facts("x", { created_at: "2026-09-01", followers: 0, following: 5000 }),
          facts("instagram", { created_at: "2026" }),
        ],
        codeProfile: code({ repos_owned: 9, forks_excluded: 9 }),
        candidates: [cand({ decision: "possibly-same-as", platform: "github", snippet: HEADLINE, profile_urls: ["https://github.com/o"] })],
      }),
    );
    const strings = [
      ...fixtures.flatMap((f) => f.now.split("\n")),
      ...wide.signals.flatMap((s) => [s.text, s.ask ?? ""]),
      ...wide.not_checked,
      ...PROFILE_SIGNAL_CAVEATS,
      LINKEDIN_CREATION_NOTE,
    ].filter((s) => s !== "");
    expect(strings.length).toBeGreaterThan(20);
    for (const s of strings) {
      expect(JUDGEMENT.test(s), s).toBe(false);
      expect(BANNED.test(s), s).toBe(false);
    }
  });
});

describe("mergeAccounts (plans/016 second source)", () => {
  const base = (over: Partial<ProfileFacts>): ProfileFacts => ({
    platform: "instagram", url: "https://www.instagram.com/jana/", handle: "jana", display_name: null, created_at: null,
    followers: null, following: null, posts: null, connections: null, verified: null, premium: null, open_to_work: null,
    bio: null, photo_url: null, earliest_experience_year: null, source_url: "https://api.apify.com/x", ...over,
  });
  it("fills nulls from the later reading and never erases an earlier number", () => {
    const apify = base({ followers: 1200, posts: 78, bio: "runner" });
    const treg = base({ url: "https://www.instagram.com/jana", followers: 1234, posts: null, verified: false, source_url: "https://treg.to/call/tikhub.instagram.user.profile?username=jana" });
    const [m, ...rest] = mergeAccounts([apify, treg]);
    expect(rest).toEqual([]);
    expect(m).toMatchObject({ followers: 1234, posts: 78, bio: "runner", verified: false, url: "https://www.instagram.com/jana/" });
  });
  it("merges two readings whose URLs differ only in path case", () => {
    const apify = base({ platform: "x", url: "https://x.com/RobertVojacek", followers: 1200 });
    const treg = base({ platform: "x", url: "https://x.com/robertvojacek", followers: 1234, verified: false });
    const [m, ...rest] = mergeAccounts([apify, treg]);
    expect(rest).toEqual([]);
    expect(m).toMatchObject({ followers: 1234, verified: false, url: "https://x.com/RobertVojacek" });
  });
  it("keeps different accounts apart", () => {
    expect(mergeAccounts([base({}), base({ url: "https://www.instagram.com/other/" })])).toHaveLength(2);
  });
});
