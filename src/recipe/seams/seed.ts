/**
 * Seed seam (plans/006): turn the manager's LinkedIn profile URL and/or pasted CV into the confirmed identity.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/seed.ts
 * Deps:    zod, src/domain/stable-id, src/domain/cv-check (CV_ACTOR), src/recipe/sources/facts (digestOf)
 * Tested:  src/recipe/__tests__/seed.test.ts, src/recipe/__tests__/cv-consistency.test.ts (CV check)
 *
 * Key responsibilities:
 * - Profile URL: one harvestapi LinkedIn run (same request and parse as the linkedin_profile collector), the profile
 *   stored as a merged Source, one merged linkedin Candidate ("profile given by the manager")
 * - CV: one `primary` LLM call extracts name, headline, location, employer and links; the CV itself is stored as a
 *   merged Source (actor "cv", url "cv:<runId>", excerpt up to CV_EXCERPT_MAX so the career history reaches the
 *   cv-consistency check); linkedin/github/x/instagram links that literally appear in the CV become merged Candidates
 * - `out.digest`: ProfileFacts of the given LinkedIn profile (harvestFacts), written to the call row's ledger ref
 * - Derive subject (profile name, CV name, given subject, name from the URL handle) and anchor (profile location,
 *   CV location, the profile URL, given anchor)
 *
 * Design constraints:
 * - Never throws for an actor or model failure: the run continues, the reason goes to `out.notes` for the ledger
 * - Pure apart from ports; the Workflow persists the outcome and updates investigations.subject/anchor
 * - Paid actor runs are counted in `actor.calls` (also on failure), model calls in `llm.calls`
 * - Idempotent: source and candidate ids are stableId(runId, "seed", kind, url), so a retried seed step upserts
 *   the same rows (INSERT OR REPLACE) instead of duplicating the profile, the CV and the merge candidate
 */
import { z } from "zod";
import type { Candidate } from "@/domain/claim";
import { CV_ACTOR } from "@/domain/cv-check";
import { nameFromHandle, normalizeLinkedinProfile } from "@/domain/profile-url";
import type { Ports } from "@/domain/ports";
import { stableId } from "@/domain/stable-id";
import { emptyOutcome, SOURCE_TTL_MS } from "@/recipe/runner";
import { canonicalProfile, profileKey } from "@/recipe/seams/resolve";
import { digestOf } from "@/recipe/sources/facts";
import { HARVEST_ACTOR, harvestFacts, harvestProfiles, harvestRequest } from "@/recipe/sources/linkedin";
import { clip, platformOf, type StepOutcome } from "@/recipe/sources/types";

export { CV_ACTOR };
/**
 * The CV is candidate-supplied, not scraped: a larger excerpt than EXCERPT_MAX keeps its career history for extract
 * (still far under the extract prompt cap and the Workflow step payload limit).
 */
export const CV_EXCERPT_MAX = 8000;
const LINK_PLATFORMS = new Set(["linkedin", "github", "x", "instagram"]);
const GIVEN_REASON = "profile given by the manager";
const CV_REASON = "linked from the CV the manager pasted";

export type SeedInput = { runId: string; subject: string; anchor: string; profileUrl: string | null; cvText: string | null };

export type SeedResult = {
  out: StepOutcome;
  subject: string;
  anchor: string;
  headline: string | null;
  employer: string | null;
  location: string | null;
  actor: { calls: number; cost_usd: number };
  llm: { calls: number; cost_usd: number };
};

type Found = { name: string; headline: string; location: string; employer: string };

const CvFacts = z.object({
  full_name: z.string(),
  headline: z.string(),
  location: z.string(),
  current_employer: z.string(),
  links: z.array(z.string()),
});

const why = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function store(input: SeedInput, ports: Ports, url: string, actor: string, excerpt: string, raw: unknown): ReturnType<Ports["storeSource"]> {
  const fetched = ports.now();
  return ports.storeSource(
    {
      id: stableId(input.runId, "seed", "source", url),
      run_id: input.runId,
      url,
      actor,
      fetched_at: fetched,
      excerpt,
      expires_at: new Date(Date.parse(fetched) + SOURCE_TTL_MS).toISOString(),
      identity: "merged",
    },
    raw,
  );
}

async function fromProfile(url: string, input: SeedInput, ports: Ports, r: SeedResult): Promise<Found | null> {
  const req = harvestRequest([url]);
  let items: readonly unknown[];
  try {
    const res = await ports.callActor({ actor: req.actor, input: req.input, timeoutSecs: req.timeoutSecs, maxTotalChargeUsd: req.maxTotalChargeUsd });
    r.actor.calls += 1;
    r.actor.cost_usd += res.cost_usd;
    items = res.items;
  } catch (e) {
    r.actor.calls += 1;
    r.out.notes.push(`profile scrape failed (${why(e)}); the profile URL is the anchor`);
    return null;
  }
  const parsed = harvestProfiles(items);
  const p = parsed.find((x) => profileKey(x.url) === profileKey(url)) ?? parsed[0];
  if (p === undefined) {
    r.out.notes.push("profile scrape returned no profile; the profile URL is the anchor");
    return null;
  }
  const sourceUrl = z.url().safeParse(p.url).success ? p.url : url;
  r.out.sources.push(await store(input, ports, sourceUrl, HARVEST_ACTOR, p.excerpt, p.raw));
  // The seeded profile is the given identity: merged by construction, so its facts are recorded without a lineup check.
  r.out.digest = digestOf([harvestFacts(p.raw)]);
  return { name: p.name, headline: p.headline, location: p.location, employer: p.employer };
}

/** Links the model returned that literally occur in the CV text (no invented profiles), on a profile platform. */
function cvLinks(links: readonly string[], cvText: string): { url: string; platform: string; handle: string | null }[] {
  const text = cvText.toLowerCase();
  const out: { url: string; platform: string; handle: string | null }[] = [];
  for (const raw of links) {
    const bare = raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
    if (bare === "" || !text.includes(bare.toLowerCase())) continue;
    const full = `https://${bare}`;
    const platform = platformOf(full);
    if (!LINK_PLATFORMS.has(platform)) continue;
    const linkedin = platform === "linkedin" ? normalizeLinkedinProfile(full) : null;
    if (platform === "linkedin" && linkedin === null) continue;
    const prof = canonicalProfile(linkedin ?? full);
    if (prof.handle === null) continue;
    out.push({ url: prof.url, platform, handle: prof.handle });
  }
  return out;
}

async function fromCv(cvText: string, input: SeedInput, ports: Ports, r: SeedResult): Promise<(Found & { links: ReturnType<typeof cvLinks> }) | null> {
  r.out.sources.push(await store(input, ports, `cv:${input.runId}`, CV_ACTOR, clip(cvText, CV_EXCERPT_MAX), { text: cvText }));
  try {
    const res = await ports.llm({
      model: "primary",
      system:
        "Read a CV and return the candidate's full name, their current headline (title line), location, current employer, and every URL written in the CV (links). Copy values exactly as written; use an empty string when the CV does not state a value. Never guess.",
      prompt: cvText,
      schema: CvFacts,
    });
    r.llm.calls += 1;
    r.llm.cost_usd += res.cost_usd;
    const v = res.value;
    return { name: v.full_name.trim(), headline: v.headline.trim(), location: v.location.trim(), employer: v.current_employer.trim(), links: cvLinks(v.links, cvText) };
  } catch (e) {
    r.out.notes.push(`CV reading failed (${why(e)}); no name or links taken from the CV`);
    return null;
  }
}

const firstOf = (...xs: (string | undefined)[]): string => xs.find((x) => x !== undefined && x.trim() !== "")?.trim() ?? "";

export async function seedProfile(input: SeedInput, ports: Ports): Promise<SeedResult> {
  const r: SeedResult = {
    out: emptyOutcome(),
    subject: input.subject,
    anchor: input.anchor,
    headline: null,
    employer: null,
    location: null,
    actor: { calls: 0, cost_usd: 0 },
    llm: { calls: 0, cost_usd: 0 },
  };
  const profileUrl = input.profileUrl;
  const profile = profileUrl === null ? null : await fromProfile(profileUrl, input, ports, r);
  const cv = input.cvText === null ? null : await fromCv(input.cvText, input, ports, r);

  r.subject = firstOf(profile?.name, cv?.name, input.subject, profileUrl === null ? undefined : nameFromHandle(profileUrl));
  const location = firstOf(profile?.location, cv?.location);
  r.anchor = firstOf(location, profileUrl ?? undefined, input.anchor);
  r.location = location === "" ? null : location;
  const headline = firstOf(profile?.headline, cv?.headline);
  r.headline = headline === "" ? null : headline;
  const employer = firstOf(profile?.employer, cv?.employer);
  r.employer = employer === "" ? null : employer;

  const name = r.subject === "" ? "the candidate" : r.subject;
  const merged = (url: string, platform: string, handle: string | null, reason: string): Candidate => ({
    id: stableId(input.runId, "seed", "candidate", url),
    run_id: input.runId,
    name,
    profile_urls: [url],
    anchor_match: r.location,
    score: 1,
    decision: "merge",
    platform,
    handle,
    snippet: r.headline ?? "",
    reasons: [reason],
  });
  const seen = new Set<string | null>();
  if (profileUrl !== null) {
    seen.add(profileKey(profileUrl));
    r.out.candidates.push(merged(profileUrl, "linkedin", canonicalProfile(profileUrl).handle, GIVEN_REASON));
  }
  for (const link of cv?.links ?? []) {
    const key = profileKey(link.url);
    if (seen.has(key)) continue;
    seen.add(key);
    r.out.candidates.push(merged(link.url, link.platform, link.handle, CV_REASON));
  }
  r.out.calls = r.actor.calls;
  r.out.cost_usd = r.actor.cost_usd + r.llm.cost_usd;
  r.out.empty = r.out.sources.length === 0 && r.out.candidates.length === 0;
  return r;
}
