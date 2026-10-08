/**
 * Resolve (incl. no-model fallback), extract and synthesize (incl. degraded brief) seam tests with a fake LLM.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/seams.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import type { Candidate, Claim, Source } from "@/domain/claim";
import { extractClaims } from "@/recipe/seams/extract";
import { canonicalProfile, decisionFor, fallbackScores, isNoise, namesSubject, noneConfirmed, pickDrafts, profileKey, resolveCandidates, sourceIdentityUpdates, UNCONFIRMED_GAP } from "@/recipe/seams/resolve";
import { verifyClaims } from "@/recipe/seams/verify";
import { askCandidate, coverageOf, excerptKey, headlineOf, locationNoteOf, profileQuestion, synthesizeBrief } from "@/recipe/seams/synthesize";
import { baseContext, fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const s = (id: string, url: string, excerpt: string): Source => ({ id, run_id: "run-1", url, actor: "apify/google-search-scraper", fetched_at: "t", excerpt, r2_key: "k", expires_at: "e", identity: "unverified" });
const cand = (id: string, url: string, decision: Candidate["decision"], platform = "linkedin", handle: string | null = null): Candidate => ({
  id, run_id: "run-1", name: "x", profile_urls: [url], anchor_match: null, score: 0.5, decision, platform, handle, snippet: "", reasons: [],
});
/** What the Workflow does after the lineup: re-mark source identity by profile key. */
const applyIdentity = (srcs: readonly Source[], cands: readonly Candidate[]): Source[] => {
  const next = new Map(sourceIdentityUpdates(cands, srcs).map((u) => [u.id, u.identity]));
  return srcs.map((x) => ({ ...x, identity: next.get(x.id) ?? x.identity }));
};
const sources = [
  s("s1", "https://cz.linkedin.com/in/jana-dvorakova-data", "Jana Dvořáková - Data Engineer - Kiwi.com | LinkedIn\nData Engineer at Kiwi.com · Brno"),
  s("s2", "https://github.com/jdvorakova", "jdvorakova (Jana Dvořáková) · GitHub\nData pipelines, dbt, Airflow. Brno."),
  s("s3", "https://cz.linkedin.com/in/jana-dvorakova-nurse", "Jana Dvořáková - dětská sestra - FN Ostrava | LinkedIn\nPediatric nurse, Ostrava"),
];

describe("resolve", () => {
  it("thresholds map scores to merge / possibly-same-as / rejected", () => {
    expect(decisionFor(0.91)).toBe("merge");
    expect(decisionFor(0.55)).toBe("possibly-same-as");
    expect(decisionFor(0.2)).toBe("rejected");
  });

  it("never merges the Ostrava decoy and asks about the ambiguous one (LLM scores)", async () => {
    const ports = fakePorts({
      llm: fakeLlm((prompt) => {
        const ids = [...prompt.matchAll(/id=(id-\d+) platform=\w+ url=(\S+)/g)].map((m) => ({ id: m[1] ?? "", url: m[2] ?? "" }));
        return ids.map(({ id, url }) => ({ id, score: url.includes("nurse") ? 0.1 : url.includes("github") ? 0.55 : 0.92, reasons: ["test"] }));
      }),
    });
    const out = await resolveCandidates(baseContext({ sources }), ports);
    const byUrl = new Map(out.candidates.map((c) => [c.profile_urls[0], c.decision]));
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-nurse")).toBe("rejected");
    expect(byUrl.get("https://github.com/jdvorakova")).toBe("possibly-same-as");
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-data")).toBe("merge");
    expect(out.candidates[0]?.platform).toBe("linkedin");
  });

  it("falls back to anchor matching when the LLM fails and never merges on its own", async () => {
    const out = await resolveCandidates(baseContext({ sources }), fakePorts());
    const byUrl = new Map(out.candidates.map((c) => [c.profile_urls[0], c.decision]));
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-data")).toBe("possibly-same-as");
    expect(byUrl.get("https://cz.linkedin.com/in/jana-dvorakova-nurse")).toBe("possibly-same-as");
  });
});

describe("resolve fallback (no model)", () => {
  it("caps anchor substring at 0.6 and name only at 0.5, so a city never merges", () => {
    const scores = fallbackScores(
      [
        { id: "a", url: "https://elib.nlb.by/search?q=x", excerpt: "Josef Buryan Praha" },
        { id: "b", url: "https://chanceliga.cz/hrac/pokorny", excerpt: "Josef Buryan, footballer" },
      ],
      "Praha",
    );
    expect(scores.map((x) => x.score)).toEqual([0.6, 0.5]);
    expect(scores.map((x) => x.reasons[0])).toEqual(["Same name, mentions Praha", "Same name only"]);
    expect(scores.map((x) => decisionFor(x.score))).toEqual(["possibly-same-as", "possibly-same-as"]);
  });

  it("merges only on hard links: anchor URL, or cross-linked drafts with the anchor in one", () => {
    const byAnchorUrl = fallbackScores([{ id: "a", url: "https://www.jana.dev/", excerpt: "Jana" }], "jana.dev");
    expect(decisionFor(byAnchorUrl[0]?.score ?? 0)).toBe("merge");
    const cross = fallbackScores(
      [
        { id: "a", url: "https://github.com/jdvorakova", excerpt: "Brno. https://cz.linkedin.com/in/jana-dvorakova-data" },
        { id: "b", url: "https://cz.linkedin.com/in/jana-dvorakova-data", excerpt: "Data Engineer" },
        { id: "c", url: "https://x.com/jana", excerpt: "Jana in Brno" },
      ],
      "Brno",
    );
    expect(cross.map((x) => decisionFor(x.score))).toEqual(["merge", "merge", "possibly-same-as"]);
    expect(byAnchorUrl[0]?.reasons).toEqual(["Profile link you supplied"]);
    expect(cross.flatMap((x) => x.reasons).join()).not.toContain("fallback");
  });

  it("ranks profile platforms before web and dedupes before the cap: LinkedIn as the 15th source still becomes a candidate", async () => {
    const web = Array.from({ length: 14 }, (_, i) => s(`w${String(i)}`, `https://news${String(i)}.cz/clanek`, "Lukáš Pokorný, Liberec"));
    const ctx = baseContext({
      subject: "Lukáš Pokorný",
      anchor: "Liberec",
      sources: [...web, s("li", "https://cz.linkedin.com/in/lukas-pokorny-data", "Lukáš Pokorný - Senior Data Engineer | LinkedIn")],
    });
    const out = await resolveCandidates(ctx, fakePorts());
    expect(out.candidates.map((c) => c.platform)).toContain("linkedin");
    expect(out.candidates[0]?.platform).toBe("linkedin");
    expect(out.candidates.filter((c) => c.platform === "web")).toHaveLength(6);
  });

  it("dedupes by host + path, pooling excerpts so the anchor mention counts, and drops PDF and genealogy noise", async () => {
    const out = await resolveCandidates(
      baseContext({
        sources: [
          s("d1", "https://rejstrik.penize.cz/osoba/jana-dvorakova?x=1", "Jana Dvořáková"),
          s("d2", "https://www.rejstrik.penize.cz/osoba/jana-dvorakova/", "Jana Dvořáková, Brno"),
          s("n1", "https://www.myheritage.cz/names/jana_dvorakova", "Jana Dvořáková"),
          s("n2", "https://example.cz/cv/dvorakova.pdf", "Jana Dvořáková"),
        ],
      }),
      fakePorts(),
    );
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0]?.score).toBe(0.6);
  });
});

describe("extract", () => {
  it("returns an empty outcome with a note when the model fails, never throws", async () => {
    const out = await extractClaims(baseContext({ sources: sources.map((x) => ({ ...x, identity: "merged" as const })) }), fakePorts());
    expect(out.empty).toBe(true);
    expect(out.claims).toHaveLength(0);
    expect(out.notes.join()).toContain("extract model failed");
  });

  it("keeps valid claims, drops FACTs without quote and unknown questions, skips rejected profiles", async () => {
    const ports = fakePorts({
      llm: fakeLlm((prompt) => {
        expect(prompt).not.toContain("nurse");
        return [
          { question_id: "current-role", text: "Data Engineer at Kiwi.com", kind: "FACT", confidence: 0.9, quote: "Data Engineer at Kiwi.com", source_ids: ["s1"] },
          { question_id: "current-role", text: "no quote fact", kind: "FACT", confidence: 0.9, quote: null, source_ids: ["s1"] },
          { question_id: "unknown", text: "x", kind: "INFERENCE", confidence: 0.5, quote: null, source_ids: [] },
        ];
      }),
    });
    const ctx = baseContext({
      // the nurse profile is marked merged on purpose: the rejected decision must still keep it out
      sources: sources.map((x) => ({ ...x, identity: "merged" as const })),
      candidates: [cand("c3", sources[2]?.url ?? "", "rejected")],
    });
    const out = await extractClaims(ctx, ports);
    expect(out.claims).toHaveLength(1);
    expect(out.notes.join()).toContain("dropped invalid claim");
  });
});

describe("identity after the lineup (namesake SERP hits never reach the model)", () => {
  const li = "https://cz.linkedin.com/in/lukas-pokorny-436438295";
  const serp = [
    s("li", `${li}/cs`, "Lukáš Pokorný - Senior Data Engineer - Liberec | LinkedIn"),
    s("post", "https://www.linkedin.com/posts/lukas-pokorny-436438295_dbt-activity-1", "Lukáš Pokorný on dbt"),
    s("foot", "https://www.fcslovanliberec.cz/hrac/lukas-pokorny", "Lukáš Pokorný, obránce FC Slovan Liberec"),
    s("ten", "https://www.linkedin.com/in/lukas-pokorny-tennis/?trk=x", "Lukáš Pokorný - tennis coach"),
  ];
  const cands = [cand("c1", li, "merge"), cand("c2", "https://cz.linkedin.com/in/lukas-pokorny-tennis", "rejected")];

  it("marks only SERP hits on the merged profile (post and locale variants included) as merged", () => {
    expect(sourceIdentityUpdates(cands, serp)).toEqual([
      { id: "li", identity: "merged" },
      { id: "post", identity: "merged" },
    ]);
    expect(profileKey("https://www.linkedin.com/posts/lukas-pokorny-436438295_x-activity-2")).toBe(profileKey(`${li}/cs`));
  });

  it("keeps the footballer out of the extract prompt and the evidence; the merged LinkedIn hit is in both", async () => {
    const ctx = baseContext({ subject: "Lukáš Pokorný", anchor: "Liberec", sources: applyIdentity(serp, cands), candidates: cands });
    let prompt = "";
    await extractClaims(ctx, fakePorts({ llm: fakeLlm((p) => ((prompt = p), [])) }));
    expect(prompt).toContain("lukas-pokorny-436438295");
    expect(prompt).not.toContain("fcslovanliberec");
    expect(prompt).not.toContain("tennis");
    const brief = (await synthesizeBrief(ctx, fakePorts())).brief;
    expect(brief?.evidence.map((e) => e.url)).toEqual([serp[0]?.url, serp[1]?.url]);
    expect(brief?.also_found.map((e) => e.url)).toEqual([serp[2]?.url]);
  });

  it("excludes a rejected profile by profile key even when a query-string variant was marked merged", async () => {
    const tennis = { ...s("t2", "https://linkedin.com/in/lukas-pokorny-tennis?trk=1", "tennis"), identity: "merged" as const };
    const ctx = baseContext({ sources: [tennis], candidates: cands });
    const out = await extractClaims(ctx, fakePorts({ llm: fakeLlm(() => []) }));
    expect(out.notes).toContain("no usable sources");
    expect((await synthesizeBrief(ctx, fakePorts())).brief?.evidence).toEqual([]);
  });
});

describe("synthesize", () => {
  const claim = (id: string, q: string, kind: Claim["kind"], text: string): Claim => ({ id, run_id: "run-1", question_id: q, candidate_id: null, text, kind, confidence: 0.8, quote: kind === "INFERENCE" ? null : text, supports: kind === "INFERENCE" ? [] : ["s1"], contradicts: [], rank: 1 });

  it("computes coverage", () => {
    expect(coverageOf([claim("a", "q", "FACT", "x")])).toBe("evidenced");
    expect(coverageOf([claim("a", "q", "INFERENCE", "x")])).toBe("partial");
    expect(coverageOf([])).toBe("none");
  });

  it("drops protected-category claims by regex even when the model fails, and turns gaps into interview questions", async () => {
    const ctx = baseContext({
      sources,
      claims: [claim("ok", "current-role", "FACT", "Data Engineer at Kiwi.com"), claim("bad", "current-role", "INFERENCE", "Posts about her religious community")],
      gaps: [{ run_id: "run-1", question_id: "public-code", reason: "no public GitHub profile found" }],
    });
    const out = await synthesizeBrief(ctx, fakePorts());
    expect(out.brief?.removed_protected).toBe(1);
    expect(out.brief?.per_question.find((p) => p.question_id === "current-role")?.coverage).toBe("evidenced");
    expect(out.brief?.per_question.find((p) => p.question_id === "public-code")?.coverage).toBe("none");
    // degraded: base research prompts never become interview questions
    expect(out.brief?.interview_questions).toEqual([]);
    expect(out.brief?.searched_empty).toEqual([{ source: "public-code", reason: "no public GitHub profile found" }]);
    expect(out.brief?.not_searched).toEqual([]);
    expect(out.brief?.degraded).toContain("summary model failed");
  });

  it("builds an evidence-only brief when there are no claims: degraded, sources linked, gaps as questions", async () => {
    const ports = fakePorts();
    const ctx = baseContext({
      sources: [...sources, s("g1", "https://api.github.com/users/someone", "someone"), s("m1", "https://github.com/jdvorakova/repo", "repo")],
      candidates: [
        cand("c2", "https://github.com/jdvorakova", "merge", "github"),
        cand("c3", sources[2]?.url ?? "", "rejected"),
        cand("c4", "https://x.com/jdvorakova", "possibly-same-as", "x", "jdvorakova"),
      ],
      gaps: [
        { run_id: "run-1", question_id: "github_profile", reason: "no public GitHub profile found" },
        { run_id: "run-1", question_id: "tiktok_profile", reason: "not searched: no confirmed handle or id to look up" },
      ],
    });
    // fixture sources use the SERP actor except the two added ones; make those non-SERP
    // the merged profile's repo was fetched for that handle (identity merged); the name-search user stays unverified
    const nonSerp = ctx.sources.map((x) =>
      x.id === "g1" || x.id === "m1" ? { ...x, actor: "rest/github", identity: x.id === "m1" ? ("merged" as const) : ("unverified" as const) } : x,
    );
    const out = await synthesizeBrief({ ...ctx, sources: applyIdentity(nonSerp, ctx.candidates) }, ports);
    const brief = out.brief;
    expect(ports.calls.llm).toHaveLength(0);
    expect(brief?.degraded).toContain("no verified claims");
    expect(brief?.per_question.every((p) => p.coverage === "none" && p.summary.startsWith("AI summary unavailable"))).toBe(true);
    // the unmerged LinkedIn SERP hit is "also found", never evidence
    expect(brief?.evidence.map((e) => e.url)).toEqual([sources[1]?.url, "https://github.com/jdvorakova/repo"]);
    expect(brief?.also_found.map((e) => e.url)).toEqual([sources[0]?.url, "https://api.github.com/users/someone"]);
    expect(brief?.not_searched).toEqual([{ source: "tiktok_profile", reason: "no confirmed handle or id to look up" }]);
    expect(brief?.searched_empty).toEqual([{ source: "github_profile", reason: "no public GitHub profile found" }]);
    expect(brief?.interview_questions).toEqual(["Is the X account jdvorakova yours?"]);
  });

  it("templates degraded interview questions: two social identity checks, then role must-haves, never web pages or base prompts", async () => {
    const ctx = baseContext({
      questions: [
        { id: "current-role", text: "What is the subject's current role and employer?" },
        { id: "public-talks", text: "What public talks, posts or writing show how they think?" },
        { id: "location-match", text: "Does their stated location match the anchor?" },
        { id: "contradictions", text: "Which sources disagree with each other?" },
        { id: "mh-title-experience", text: "Has held a Senior Data Engineer position or equivalent (job history, profile)" },
        { id: "mh-public-work", text: "Has public work showing Senior Data Engineer skills (repo, talk)" },
        { id: "mh-location-fit", text: "Location compatible with Prague (profile location)" },
        { id: "mh-where", text: "Is the subject's stated location in the Prague area?" },
      ],
      candidates: [
        cand("w", "https://www.fiba.basketball/player/x", "possibly-same-as", "web"),
        cand("b", "https://www.bloomberg.com/profile/person/1", "possibly-same-as", "web"),
        { ...cand("l", "https://www.linkedin.com/in/josef-buryan/", "possibly-same-as", "linkedin", "josef-buryan"), score: 0.7 },
        ...["a", "b2", "c"].map((h) => cand(h, `https://x.com/${h}`, "possibly-same-as", "x", h)),
      ],
      gaps: [{ run_id: "run-1", question_id: "huggingface_profile", reason: "no Hugging Face models or datasets found" }],
    });
    const qs = (await synthesizeBrief(ctx, fakePorts())).brief?.interview_questions ?? [];
    expect(qs).toEqual([
      "Is the LinkedIn account josef-buryan yours?",
      "Is the X account a yours?",
      "Have you held a Senior Data Engineer position or equivalent?",
      "Do you have public work showing Senior Data Engineer skills?",
      "Is your location compatible with Prague?",
      "Is your location in the Prague area?",
    ]);
    expect(qs.join(" ")).not.toMatch(/fiba|bloomberg|the subject|anchor|huggingface_profile/);
    expect(askCandidate("What is the subject's current role and employer?")).toBe("What is your current role and employer?");
    expect(askCandidate("What public talks, posts or writing show how they think?")).toBe("What public talks, posts or writing show how you think?");
    expect(askCandidate("Does the subject's stated location fit?")).toBe("Does your location fit?");
    expect(askCandidate("Which sources disagree with each other?")).toBeNull();
  });
});

describe("canonicalProfile", () => {
  it("collapses posts, statuses and photos onto the profile they belong to", () => {
    expect(canonicalProfile("https://www.linkedin.com/posts/josef-buryan_groupon-activity-7312840998689103873-C4IV")).toEqual({
      url: "https://www.linkedin.com/in/josef-buryan/",
      handle: "josef-buryan",
    });
    expect(canonicalProfile("https://cz.linkedin.com/in/Luk%C3%A1%C5%A1-pokorn%C3%BD-436438295/cs")).toEqual({
      url: "https://cz.linkedin.com/in/Luk%C3%A1%C5%A1-pokorn%C3%BD-436438295/cs",
      handle: "lukáš-pokorný-436438295",
    });
    expect(canonicalProfile("https://x.com/josefburyan/status/123")).toEqual({ url: "https://x.com/josefburyan", handle: "josefburyan" });
    expect(canonicalProfile("https://www.instagram.com/p/abc/")).toEqual({ url: "https://www.instagram.com/p/abc/", handle: null });
    expect(canonicalProfile("https://www.linkedin.com/pub/dir/Lukas/Pokorny")).toEqual({ url: "https://www.linkedin.com/pub/dir/Lukas/Pokorny", handle: null });
  });
});

describe("directory and listing pages are never candidates", () => {
  const pokornyDir = "https://cz.linkedin.com/pub/dir/Luk%C3%A1%C5%A1/Pokorn%C3%BD";
  it("flags LinkedIn directories, non-profile LinkedIn paths, Facebook /public/ and listing titles", () => {
    expect(isNoise(pokornyDir, "30+ profilů „Lukáš Pokorný“ | LinkedIn")).toBe(true);
    expect(isNoise("https://www.linkedin.com/directory/people-p")).toBe(true);
    expect(isNoise("https://www.linkedin.com/search/results/people/?keywords=x")).toBe(true);
    expect(isNoise("https://www.facebook.com/public/Lukas-Pokorny")).toBe(true);
    expect(isNoise("https://example.com/x", '100+ "Lukas Pokorny" profiles')).toBe(true);
    expect(isNoise("https://example.com/x", "People named Lukas Pokorny")).toBe(true);
    expect(isNoise("https://example.com/x", "Results for Lukas Pokorny")).toBe(true);
    expect(isNoise("https://cz.linkedin.com/in/lukas-pokorny-1", "Lukáš Pokorný - Liberec | LinkedIn")).toBe(false);
    expect(isNoise("https://www.linkedin.com/company/groupon")).toBe(false);
    expect(isNoise("https://www.facebook.com/josefburyan")).toBe(false);
  });
  it("never drafts the Pokorný directory page", () => {
    const ctx = baseContext({ subject: "Lukáš Pokorný", sources: [s("d", pokornyDir, "30+ profilů „Lukáš Pokorný“"), s("p", "https://cz.linkedin.com/in/lukas-pokorny-1", "Lukáš Pokorný")] });
    expect(pickDrafts(ctx).map((d) => d.url)).toEqual(["https://cz.linkedin.com/in/lukas-pokorny-1"]);
  });
});

describe("canonicalProfile: Facebook and YouTube", () => {
  it("maps Facebook profiles to a handle and leaves listings, groups and pages without one", () => {
    expect(canonicalProfile("https://m.facebook.com/josefburyan/posts/123")).toEqual({ url: "https://www.facebook.com/josefburyan", handle: "josefburyan" });
    expect(canonicalProfile("https://www.facebook.com/profile.php?id=1000123")).toEqual({ url: "https://www.facebook.com/profile.php?id=1000123", handle: "1000123" });
    for (const u of ["https://www.facebook.com/public/Josef-Buryan", "https://www.facebook.com/people/x/1", "https://www.facebook.com/groups/abc", "https://www.facebook.com/pages/x/1"]) {
      expect(canonicalProfile(u).handle).toBeNull();
    }
    expect(profileKey("https://www.facebook.com/profile.php?id=1")).not.toBe(profileKey("https://www.facebook.com/profile.php?id=2"));
  });
  it("maps YouTube @handle, /channel/ and /c/ to a handle; a watch link has none (never 'watch')", () => {
    expect(canonicalProfile("https://www.youtube.com/@JosefBuryan/videos")).toEqual({ url: "https://www.youtube.com/@JosefBuryan", handle: "josefburyan" });
    expect(canonicalProfile("https://www.youtube.com/channel/UC123").handle).toBe("UC123");
    expect(canonicalProfile("https://www.youtube.com/c/groupon").handle).toBe("groupon");
    expect(canonicalProfile("https://www.youtube.com/watch?v=abc")).toEqual({ url: "https://www.youtube.com/watch?v=abc", handle: null });
  });
  it("collapses the two facebook.com/josefburyan rows seen in the Buryan run into one draft", () => {
    const ctx = baseContext({
      subject: "Josef Buryan",
      sources: [
        s("f1", "https://www.facebook.com/josefburyan/", "Josef Buryan (@josefburyan)"),
        s("f2", "https://cs-cz.facebook.com/josefburyan", "Josef Buryan (@josefburyan)"),
        s("f3", "https://m.facebook.com/josefburyan/photos", "Josef Buryan"),
      ],
    });
    expect(pickDrafts(ctx)).toHaveLength(1);
  });
});

describe("AI call counts are truthful", () => {
  const merged = sources.map((x) => ({ ...x, identity: "merged" as const }));
  const fact: Claim = { id: "c1", run_id: "run-1", question_id: "current-role", candidate_id: null, text: "Data Engineer", kind: "FACT", confidence: 0.9, quote: "Data Engineer at Kiwi.com", supports: ["s1"], contradicts: [], rank: 1 };
  it("counts 0 when the model throws (keyless run)", async () => {
    expect((await resolveCandidates(baseContext({ sources }), fakePorts())).calls).toBe(0);
    expect((await extractClaims(baseContext({ sources: merged }), fakePorts())).calls).toBe(0);
    expect((await verifyClaims(baseContext({ sources: merged, claims: [fact] }), fakePorts())).calls).toBe(0);
    expect((await synthesizeBrief(baseContext({ sources: merged, claims: [fact] }), fakePorts())).calls).toBe(0);
  });
  it("counts each successful model call", async () => {
    const ok = fakePorts({ llm: fakeLlm(() => []) });
    expect((await resolveCandidates(baseContext({ sources }), ok)).calls).toBe(1);
    expect((await extractClaims(baseContext({ sources: merged }), ok)).calls).toBe(1);
    expect((await verifyClaims(baseContext({ sources: merged, claims: [fact] }), ok)).calls).toBe(1);
    // protected-category check + summary
    expect((await synthesizeBrief(baseContext({ sources: merged, claims: [fact] }), ok)).calls).toBe(2);
  });
});

describe("review 004: handles, namesakes, political pages, brief top line", () => {
  it("never turns an Instagram post, reel or browse path into a handle; generic last segment only on web", () => {
    expect(canonicalProfile("https://www.instagram.com/p/DCYoauFAOYx/")).toEqual({ url: "https://www.instagram.com/p/DCYoauFAOYx/", handle: null });
    for (const path of ["reel/x", "reels/x", "tv/x", "stories/josef/1", "popular/josef", "explore/tags/x"]) {
      expect(canonicalProfile(`https://www.instagram.com/${path}/`).handle).toBeNull();
    }
    expect(canonicalProfile("https://www.instagram.com/josefburyan/").handle).toBe("josefburyan");
    expect(canonicalProfile("https://www.tiktok.com/discover/josef-buryan").handle).toBeNull();
    expect(canonicalProfile("https://x.com/search?q=x").handle).toBeNull();
    expect(canonicalProfile("https://bsky.app/profile/jana.bsky.social/post/1").handle).toBe("jana.bsky.social");
    expect(canonicalProfile("https://rejstrik.penize.cz/osoba/jana-dvorakova").handle).toBe("jana-dvorakova");
  });

  it("drops surname-only namesakes: the Pokorný GitHub set keeps Lukáš only", () => {
    const gh = (h: string, name: string) => s(h, `https://github.com/${h}`, `${h} (${name}) · GitHub`);
    const ctx = baseContext({
      subject: "Lukáš Pokorný",
      sources: [gh("mpokorny", "Martin Pokorný"), gh("dpokorny", "Daniel Pokorný"), gh("robinp", "Robin Pokorný"), gh("alexpokorny", "Alex Pokorný"), gh("lpokorny", "Lukas Pokorny")],
    });
    expect(pickDrafts(ctx).map((d) => d.url)).toEqual(["https://github.com/lpokorny"]);
    expect(namesSubject("Jozef Buryan", "https://www.linkedin.com/in/x", "Josef Buryan - CMO, Groupon | LinkedIn")).toBe(true);
    expect(namesSubject("Lukáš Pokorný", "https://example.cz/a", "L. Pokorný: interview")).toBe(true);
    expect(namesSubject("Lukáš Pokorný", "https://www.linkedin.com/in/lukas-pokorny-1", "Profile")).toBe(true);
    expect(namesSubject("Lukáš Pokorný", "https://www.linkedin.com/in/martin-pokorny", "Martin Pokorný | LinkedIn")).toBe(false);
  });

  it("caps each profile platform at 4 so Instagram, X and Facebook still reach the 12", () => {
    const li = Array.from({ length: 8 }, (_, i) => s(`l${String(i)}`, `https://www.linkedin.com/in/lukas-pokorny-${String(i)}`, "Lukáš Pokorný | LinkedIn"));
    const gh = Array.from({ length: 8 }, (_, i) => s(`g${String(i)}`, `https://github.com/lukaspokorny${String(i)}`, "Lukáš Pokorný · GitHub"));
    const ig = s("ig", "https://www.instagram.com/lukas.pokorny/", "Lukáš Pokorný (@lukas.pokorny) • Instagram");
    const x = s("x", "https://x.com/lukaspokorny", "Lukáš Pokorný (@lukaspokorny) / X");
    const urls = pickDrafts(baseContext({ subject: "Lukáš Pokorný", sources: [...li, ...gh, ig, x] })).map((d) => d.url);
    expect(urls.filter((u) => u.includes("linkedin"))).toHaveLength(4);
    expect(urls.filter((u) => u.includes("github"))).toHaveLength(4);
    expect(urls).toContain(ig.url);
    expect(urls).toContain(x.url);
  });

  it("keeps election pages out of the lineup but never drops a real profile on an Art. 9 word", () => {
    const kurzy = s("k", "https://www.kurzy.cz/volby/osoba/josef-buryan", "Josef Buryan - Výsledky voleb | Kurzy.cz");
    expect(isNoise(kurzy.url, kurzy.excerpt)).toBe(true);
    expect(isNoise("https://example.cz/a", "Josef Buryan, kandidát do zastupitelstva")).toBe(true);
    expect(isNoise("https://www.linkedin.com/in/jb", "Josef Buryan - Head of Health Partnerships")).toBe(false);
    expect(pickDrafts(baseContext({ subject: "Josef Buryan", sources: [kurzy] }))).toEqual([]);
  });

  it("asks about a profile by its title, never by slug, and skips profiles without a handle", async () => {
    const li = { ...cand("l", "https://www.linkedin.com/in/josef-buryan-1a2b/", "possibly-same-as", "linkedin", "josef-buryan-1a2b"), snippet: "Josef Buryan - CMO, Groupon | LinkedIn" };
    expect(profileQuestion(li)).toBe("Is the LinkedIn profile 'Josef Buryan - CMO, Groupon | LinkedIn' yours?");
    const post = cand("p", "https://www.instagram.com/p/DCYoauFAOYx/", "possibly-same-as", "instagram", null);
    const qs = (await synthesizeBrief(baseContext({ candidates: [post, li] }), fakePorts())).brief?.interview_questions ?? [];
    expect(qs).toEqual(["Is the LinkedIn profile 'Josef Buryan - CMO, Groupon | LinkedIn' yours?"]);
  });

  it("quotes the best merged profile's title as the headline (LinkedIn first) and dedupes evidence by excerpt", async () => {
    const merged = (id: string, url: string, platform: string, snippet: string): Candidate => ({ ...cand(id, url, "merge", platform, id), snippet });
    expect(headlineOf([merged("x", "https://x.com/jb", "x", "JB on X"), merged("l", "https://www.linkedin.com/in/jb", "linkedin", "Josef Buryan - CMO, Groupon")])).toBe("Josef Buryan - CMO, Groupon");
    expect(headlineOf([cand("o", "https://www.linkedin.com/in/jb", "possibly-same-as")])).toBeNull();
    expect(headlineOf([merged("l", "https://www.linkedin.com/in/jb", "linkedin", "a".repeat(200))])?.length).toBe(160);
    const twice = [
      { ...s("e1", "https://www.linkedin.com/in/jb", "Josef Buryan - CMO, Groupon"), identity: "merged" as const },
      { ...s("e2", "https://cz.linkedin.com/in/jb/cs", "Josef  Buryan - CMO, Groupon "), identity: "merged" as const },
    ];
    const brief = (await synthesizeBrief(baseContext({ sources: twice }), fakePorts())).brief;
    expect(brief?.evidence).toHaveLength(1);
    expect(brief?.degraded).toBe("no verified claims");
  });
});

describe("Facebook as a profile platform", () => {
  it("canonicalises fb.com, asks about a Facebook profile by title, and keeps unmerged Facebook out of evidence", async () => {
    expect(canonicalProfile("https://fb.com/josefburyan")).toEqual({ url: "https://www.facebook.com/josefburyan", handle: "josefburyan" });
    expect(isNoise("https://fb.com/public/Josef-Buryan")).toBe(true);
    const fb = { ...cand("f", "https://www.facebook.com/josefburyan", "possibly-same-as", "facebook", "josefburyan"), snippet: "Josef Buryan | Facebook" };
    const src = s("fs", "https://www.facebook.com/josefburyan", "Josef Buryan | Facebook");
    const brief = (await synthesizeBrief(baseContext({ candidates: [fb], sources: [src] }), fakePorts())).brief;
    expect(brief?.interview_questions[0]).toBe("Is the Facebook profile 'Josef Buryan | Facebook' yours?");
    expect(brief?.evidence).toEqual([]);
    expect(brief?.also_found.map((e) => e.url)).toEqual([src.url]);
  });
});

describe("review 005: unconfirmed gaps, one question per platform, location note, dedupe, Facebook", () => {
  const merged = (id: string, url: string, platform: string, snippet: string): Candidate => ({ ...cand(id, url, "merge", platform, id), snippet });
  const pokornyLi = merged("l", "https://cz.linkedin.com/in/lukas-pokorny-tech", "linkedin", "Lukáš Pokorný - technik - Lokalita: Jihomoravský | LinkedIn");

  it("flags a collector whose hits are all namesakes; a hit on a merged profile or an empty result is not flagged", () => {
    const gh = { ...s("g", "https://github.com/lpokorny", "lpokorny"), actor: "rest/github" };
    expect(noneConfirmed([gh], [pokornyLi])).toBe(true);
    expect(noneConfirmed([{ ...gh, identity: "merged" }], [pokornyLi])).toBe(false);
    expect(noneConfirmed([s("l2", "https://www.linkedin.com/in/lukas-pokorny-tech/cs", "x")], [pokornyLi])).toBe(false);
    expect(noneConfirmed([], [pokornyLi])).toBe(false);
  });

  it("lists every namesake-only collector of a Pokorný-shaped run under searched_empty", async () => {
    const steps = ["github_profile", "orcid_search", "openalex_author", "stackexchange_profile", "bluesky_profile", "youtube_channel", "personal_site_crawl", "talks_serp"];
    const gaps = [...steps.map((id) => ({ run_id: "run-1", question_id: id, reason: UNCONFIRMED_GAP })), { run_id: "run-1", question_id: "huggingface_profile", reason: "no Hugging Face models or datasets found" }];
    const brief = (await synthesizeBrief(baseContext({ subject: "Lukáš Pokorný", anchor: "Liberec", candidates: [pokornyLi], gaps }), fakePorts())).brief;
    expect(brief?.searched_empty.filter((g) => g.reason === UNCONFIRMED_GAP).map((g) => g.source)).toEqual(steps);
    expect(brief?.searched_empty).toHaveLength(9);
  });

  it("asks at most one identity question per platform and none where a profile is already merged", async () => {
    const open = (id: string, platform: string, score: number, snippet: string): Candidate => ({ ...cand(id, `https://${platform}.com/${id}`, "possibly-same-as", platform, id), score, snippet });
    const candidates = [
      pokornyLi,
      open("li2", "linkedin", 0.6, "Lukáš Pokorný - sales director at Übersetzungen Deutsch"),
      open("gh1", "github", 0.55, "lpokorny (Lukas Pokorny)"),
      open("gh2", "github", 0.5, "lukaspokorny (Lukáš Pokorný)"),
      open("ig1", "instagram", 0.45, "Lukáš Pokorný (@lukas.pokorny)"),
    ];
    const qs = (await synthesizeBrief(baseContext({ candidates }), fakePorts())).brief?.interview_questions ?? [];
    const identity = qs.filter((q) => q.includes("profile"));
    expect(identity).toEqual(["Is the GitHub profile 'lpokorny (Lukas Pokorny)' yours?", "Is the Instagram profile 'Lukáš Pokorný (@lukas.pokorny)' yours?"]);
  });

  it("notes a confirmed profile in another region than the anchor, and stays quiet when the anchor appears", async () => {
    expect(locationNoteOf("Liberec", [pokornyLi], [])).toBe("Confirmed profile mentions Jihomoravský, you entered Liberec");
    expect(locationNoteOf("Brno", [pokornyLi], [])).toBeNull();
    expect(locationNoteOf("Liberec", [merged("x", "https://x.com/lp", "x", "Lukáš Pokorný, Liberec")], [])).toBeNull();
    const liSrc = { ...s("ls", "https://cz.linkedin.com/in/lp", "Lukáš Pokorný\nPraha, Hlavní město Praha"), identity: "merged" as const };
    expect(locationNoteOf("Liberec", [merged("m", "https://cz.linkedin.com/in/lp", "linkedin", "Lukáš Pokorný - Developer")], [liSrc])).toBe("Confirmed profile mentions Praha, you entered Liberec");
    expect(locationNoteOf("Liberci", [pokornyLi], [{ ...liSrc, excerpt: "v Liberci" }])).toBeNull();
    expect(locationNoteOf("27082440", [pokornyLi], [])).toBeNull();
    expect(locationNoteOf("kiwi.com", [pokornyLi], [])).toBeNull();
    expect(locationNoteOf("Liberec", [{ ...pokornyLi, decision: "possibly-same-as" }], [])).toBeNull();
    const brief = (await synthesizeBrief(baseContext({ anchor: "Liberec", candidates: [pokornyLi] }), fakePorts())).brief;
    expect(brief?.location_note).toBe("Confirmed profile mentions Jihomoravský, you entered Liberec");
    expect((await synthesizeBrief(baseContext(), fakePorts())).brief?.location_note).toBeNull();
  });

  it("dedupes Buryan's '...' and '...Read more' pairs and keeps the longer excerpt", async () => {
    const text = "Josef Buryan - CMO, Groupon. Marketing leader with 15 years in e-commerce";
    expect(excerptKey(`${text}...`)).toBe(excerptKey(`${text} ...Read more`));
    expect(excerptKey(`${text}…`)).toBe(excerptKey(`${text} Více`));
    const m = (id: string, excerpt: string): Source => ({ ...s(id, `https://www.linkedin.com/in/jb/${id}`, excerpt), identity: "merged" });
    const brief = (await synthesizeBrief(baseContext({ sources: [m("a", `${text}...`), m("b", `${text} ...Read more`), m("c", `${text}…`), m("d", "Other post")] }), fakePorts())).brief;
    expect(brief?.evidence.map((e) => e.excerpt)).toEqual([`${text} ...Read more`, "Other post"]);
  });

  it("adds a Facebook line under not_searched only when a Facebook candidate exists", async () => {
    const fb = { ...cand("f", "https://www.facebook.com/josefburyan", "possibly-same-as", "facebook", "josefburyan"), snippet: "Josef Buryan | Facebook" };
    const brief = (await synthesizeBrief(baseContext({ candidates: [fb] }), fakePorts())).brief;
    expect(brief?.not_searched).toContainEqual({ source: "facebook_profile", reason: "not collected: public Facebook pages need a login" });
    expect((await synthesizeBrief(baseContext(), fakePorts())).brief?.not_searched).toEqual([]);
  });
});
