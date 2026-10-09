/**
 * Eval harness: runs one synthetic persona through the real research seams with replayed ports (no network, no keys).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/harness.ts
 * Deps:    src/recipe (runner, seams, hiring recipe), src/domain (corroborate, cv-check)
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - Real code path: seedProfile -> serp_person, social_serp -> resolve_lineup -> linkedin_profile, github_profile,
 *   stackexchange_profile -> source identity pass -> extract -> verify (incl. devil's advocate) -> synthesize
 * - Replayed ports: the LinkedIn scrape, SERP hits, REST payloads and every model answer come from `persona.recorded`;
 *   a model call the persona has no answer for is recorded in `problems` (the eval test fails on any); the two enriched
 *   profile calls answer "nothing found" (the profile is not scored)
 * - A recorded claim citing a page the persona records but the run never collected (identity kept it out) drops that
 *   source, and the claim when none is left: the live model only sees collected pages. Any other unknown URL is a problem
 * - Gaps follow the Workflow's rule (src/workflow/research-run.ts doStep): not searched / unconfirmed / onEmpty gap
 * - Lineup (`EvalMode`, `lineup`): where the Workflow would pause (`lineupNeedsAnswer`) the run page asks `questionsToAsk`
 *   (at most LINEUP_MAX_QUESTIONS). "recruiter": a simulated recruiter answers from the ground truth (own profile: yes,
 *   namesake: no, a profile the truth does not list: not sure) and the answer goes through the same path as a real one
 *   (every candidate's decision sent, then setCandidateDecisions + applySourceIdentity). "strict": nobody answers,
 *   possibly-same-as stays unmerged. Both modes record the questions in `lineup`
 *
 * Design constraints:
 * - Never imports src/workflow (Workers runtime); the few lines of Workflow glue are mirrored here and named as such
 * - The simulated recruiter only answers what the product asks: an auto `merge` or `rejected` is never overridden,
 *   so an auto-merged namesake stays an unsafe miss. It is always right; a real recruiter can be wrong
 * - Deterministic: fixed clock, counter ids
 */
import { LINEUP_MAX_QUESTIONS, questionsToAsk } from "@/app/runs/[id]/state";
import type { Brief, Candidate, CandidateDecision, Claim, Gap, Source } from "@/domain/claim";
import type { ChallengeRecord } from "@/domain/challenge";
import { headlineOrgs } from "@/domain/corroborate";
import { withCvQuestion } from "@/domain/cv-check";
import type { LlmCall, Ports } from "@/domain/ports";
import { canonicalUrl } from "@/domain/url";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { executeStep } from "@/recipe/runner";
import { familyOf } from "@/domain/position";
import { CHALLENGE_SYSTEM } from "@/recipe/seams/challenge";
import { lineupNeedsAnswer, noneConfirmed, profileKey, sourceIdentityUpdates, UNCONFIRMED_GAP } from "@/recipe/seams/resolve";
import { seedProfile } from "@/recipe/seams/seed";
import { HARVEST_ACTOR } from "@/recipe/sources/linkedin";
import type { StepContext, StepOutcome } from "@/recipe/sources/types";
import type { Persona } from "./persona";

/** The hiring recipe steps the eval replays, in recipe order (other collectors need payloads no persona records). */
export const EVAL_STEPS = ["serp_person", "social_serp", "resolve_lineup", "linkedin_profile", "github_profile", "stackexchange_profile", "extract_claims", "verify_claims", "synthesize_report"] as const;

const NOW = "2026-10-09T00:00:00.000Z";
const COLLECTORS = new Set(["serp", "actor", "ares"]);
const SERP_ACTOR = "apify/google-search-scraper";

/** "recruiter": a simulated recruiter answers the lineup from the ground truth; "strict": nobody answers. */
export type EvalMode = "recruiter" | "strict";

/** One lineup question the run page shows; `answer` is the simulated recruiter's reply (null in strict mode). */
export type LineupQuestion = {
  url: string;
  platform: Candidate["platform"];
  truth: "own" | "namesake" | "unknown";
  note: string;
  answer: CandidateDecision | null;
};

/** `paused`: the Workflow would wait for an answer. `leftOpen`: possibly-same-as profiles beyond the question cap. */
export type LineupRecord = { paused: boolean; questions: LineupQuestion[]; leftOpen: string[] };

export type PipelineResult = {
  subject: string;
  anchor: string;
  questions: StepContext["questions"];
  candidates: Candidate[];
  sources: Source[];
  claims: Claim[];
  gaps: Gap[];
  brief: Brief | null;
  challenge: ChallengeRecord | null;
  lineup: LineupRecord;
  /** Step notes, in order, prefixed with the step id. */
  notes: string[];
  /** Harness errors: a model call or source the persona has no recorded answer for. */
  problems: string[];
};

/** Prompt blocks "id=<id>\nclaim: <text>" (verify model and devil's advocate) as [id, text] pairs. */
function claimBlocks(prompt: string): [string, string][] {
  return prompt.split("\n\n").flatMap((block): [string, string][] => {
    const id = /^id=(.+)$/m.exec(block)?.[1];
    const text = /^claim: (.*)$/m.exec(block)?.[1];
    return id === undefined || text === undefined ? [] : [[id, text]];
  });
}

/** Every URL the persona's recorded world could return: SERP hits and `html_url` fields of the REST payloads. */
function recordedUrls(p: Persona): Set<string> {
  const urls = new Set(Object.values(p.recorded.serp).flat().map((h) => canonicalUrl(h.url)));
  JSON.stringify(p.recorded.fetch, (k, v: unknown) => {
    if (k === "html_url" && typeof v === "string") urls.add(canonicalUrl(v));
    return v;
  });
  return urls;
}

/** The recorded model: picks the answer by the seam's system prompt. Unknown calls throw and are listed in `problems`. */
function recordedLlm(p: Persona, sources: () => readonly Source[], runId: string, problems: string[]): LlmCall {
  const answer = (system: string, prompt: string): unknown => {
    if (system.startsWith("Read a CV")) {
      if (p.recorded.cvFacts === undefined) throw new Error("no recorded CV facts");
      return p.recorded.cvFacts;
    }
    if (system.startsWith("You resolve whether")) {
      return [...prompt.matchAll(/^- id=(\S+) platform=\S+ url=(\S+)$/gm)].map(([, id = "", url = ""]) => {
        const hit = Object.entries(p.recorded.resolve).find(([u]) => profileKey(u) === profileKey(url));
        if (hit === undefined) throw new Error(`no recorded identity score for ${url}`);
        return { id, ...hit[1] };
      });
    }
    if (system.startsWith("Extract claims")) {
      const byUrl = new Map(sources().map((s) => [canonicalUrl(s.url), s.id]));
      const world = recordedUrls(p);
      return p.recorded.extract.flatMap((c) => {
        const ids = c.sources.flatMap((u) => {
          const id = byUrl.get(canonicalUrl(u === "cv" ? `cv:${runId}` : u));
          if (id !== undefined) return [id];
          if (world.has(canonicalUrl(u))) return [];
          throw new Error(`recorded claim cites a source the run does not have: ${u}`);
        });
        return ids.length === 0 ? [] : [{ question_id: c.question_id, text: c.text, kind: c.kind, confidence: c.confidence, quote: c.quote, source_ids: ids }];
      });
    }
    if (system.startsWith("You check whether a quote")) {
      return claimBlocks(prompt).map(([id, text]) => ({ id, supported: !p.recorded.verifyRejects.includes(text) }));
    }
    if (system === CHALLENGE_SYSTEM) {
      return claimBlocks(prompt).map(([id, text]) => {
        const ch = p.recorded.challenges[text];
        return ch === undefined ? { id, holds: true, ground: null, why: "" } : { id, holds: false, ground: ch.ground, why: ch.why };
      });
    }
    if (system.startsWith("Flag claims")) {
      return [...prompt.matchAll(/^id=([^:]+):/gm)].map(([, id = ""]) => ({ id, protected: false }));
    }
    if (system.startsWith("Write the hiring-manager brief")) {
      if (p.recorded.summaryFails !== undefined) throw new Error(p.recorded.summaryFails);
      return [...prompt.matchAll(/^## ([^:]+): (.+)$/gm)].map(([, qid = "", text = ""]) => ({
        question_id: qid,
        summary: `Recorded summary for ${qid}.`,
        interview_question: `Interview: ${text}`,
      }));
    }
    // The enriched profile (src/recipe/seams/profile.ts) is not scored by the eval: both calls find nothing
    if (system.startsWith("Build the candidate's profile")) return { achievements: [], risks: [], history: [] };
    if (system.startsWith("Read the candidate")) {
      return { personality: { disc: null, mbti: null, read: "", traits: [], evidence: [] }, position_fit: null, questions: [] };
    }
    throw new Error(`no recorded model answer for system prompt "${system.slice(0, 40)}"`);
  };
  return ((input: { system: string; prompt: string }) => {
    try {
      return Promise.resolve({ value: answer(input.system, input.prompt), cost_usd: 0 });
    } catch (error) {
      if (p.recorded.summaryFails === undefined || !input.system.startsWith("Write the hiring-manager brief")) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }) as LlmCall;
}

/** Source identity re-marked by profile key, then name + employer: mirrors applySourceIdentity (src/adapters/d1.ts). */
function withSourceIdentity(ctx: StepContext, orgs: readonly string[]): StepContext {
  const updates = new Map(sourceIdentityUpdates(ctx.candidates, ctx.sources, { subject: ctx.subject, orgs }).map((u) => [u.id, u.identity]));
  return { ...ctx, sources: ctx.sources.map((s) => ({ ...s, identity: updates.get(s.id) ?? s.identity })) };
}

/**
 * The lineup after resolve. Mirrors ResearchRunWorkflow.resolveWithPause (pause when lineupNeedsAnswer), the run page
 * (questionsToAsk with LINEUP_MAX_QUESTIONS; one send with every candidate's decision, answered ones replaced) and
 * setCandidateDecisions (store the decisions, then applySourceIdentity). The answer comes from the ground truth.
 */
export function lineup(p: Persona, ctx: StepContext, orgs: readonly string[], mode: EvalMode): { ctx: StepContext; record: LineupRecord } {
  if (!lineupNeedsAnswer(ctx.candidates)) return { ctx, record: { paused: false, questions: [], leftOpen: [] } };
  const asked = questionsToAsk(ctx.candidates, LINEUP_MAX_QUESTIONS);
  const answers = new Map<string, CandidateDecision>();
  const questions = asked.map((c): LineupQuestion => {
    const keys = new Set(c.profile_urls.map(profileKey).filter((k) => k !== null));
    const t = p.truth.profiles.find((x) => keys.has(profileKey(x.url) ?? ""));
    const truth = t === undefined ? "unknown" : t.person ? "own" : "namesake";
    // Yes / No / Not sure, the three buttons of the run page's question card
    const answer: CandidateDecision | null = mode === "strict" ? null : truth === "own" ? "merge" : truth === "namesake" ? "rejected" : "possibly-same-as";
    if (answer !== null) answers.set(c.id, answer);
    return { url: c.profile_urls[0] ?? "", platform: c.platform, truth, note: t?.note ?? "not in the ground truth", answer };
  });
  const askedIds = new Set(asked.map((c) => c.id));
  const leftOpen = ctx.candidates.filter((c) => c.decision === "possibly-same-as" && !askedIds.has(c.id)).map((c) => c.profile_urls[0] ?? c.id);
  const record = { paused: true, questions, leftOpen };
  if (mode === "strict") return { ctx, record };
  const candidates = ctx.candidates.map((c) => ({ ...c, decision: answers.get(c.id) ?? c.decision }));
  return { ctx: withSourceIdentity({ ...ctx, candidates }, orgs), record };
}

export async function runPersona(p: Persona, mode: EvalMode): Promise<PipelineResult> {
  const runId = `eval-${p.id}`;
  const problems: string[] = [];
  const notes: string[] = [];
  let current = "";
  let n = 0;
  // The recorded extract maps source URLs to run ids, so the model port reads the run's sources as they grow
  let known: readonly Source[] = [];
  const ports: Ports = {
    callActor: ({ actor }) => {
      if (actor === HARVEST_ACTOR) return Promise.resolve({ items: p.recorded.linkedin === null ? [] : [p.recorded.linkedin], cost_usd: 0 });
      if (actor === SERP_ACTOR) {
        const hits = current === "serp_person" || current === "social_serp" ? (p.recorded.serp[current] ?? []) : [];
        return Promise.resolve({ items: [{ organicResults: hits }], cost_usd: 0 });
      }
      problems.push(`no recorded answer for actor ${actor}`);
      return Promise.reject(new Error(`no recorded answer for actor ${actor}`));
    },
    // Any URL the persona did not record answers like a search that found nothing
    fetchJson: (url) => Promise.resolve(url in p.recorded.fetch ? p.recorded.fetch[url] : { items: [] }),
    llm: recordedLlm(p, () => known, runId, problems),
    appendLedger: (e) => Promise.resolve({ ...e, seq: ++n, ts: NOW }),
    storeSource: (s) => Promise.resolve({ ...s, r2_key: `${s.run_id}/${s.id}.json` }),
    now: () => NOW,
    newId: () => `${p.id}-${String(++n)}`,
  };

  const seed = await seedProfile({ runId, subject: "", anchor: "", profileUrl: p.profileUrl, cvText: p.cvText }, ports);
  notes.push(...seed.out.notes.map((x) => `seed_profile: ${x}`));
  let ctx: StepContext = {
    runId,
    subject: seed.subject,
    anchor: seed.anchor,
    goal: "hiring",
    role: p.role,
    roleFamily: familyOf(p.role),
    roleSites: [],
    questions: withCvQuestion("hiring", [...hiringRecipe.questions, ...p.mustHaves], seed.out.sources),
    candidates: seed.out.candidates,
    sources: seed.out.sources,
    claims: [],
    gaps: [],
    budget: { usd: 0.5, calls: 16 },
    spent: { usd: seed.out.cost_usd, calls: seed.actor.calls },
  };
  const orgs = [seed.employer ?? "", ...headlineOrgs(seed.headline ?? "")].filter((o) => o !== "");
  let brief: Brief | null = null;
  let challenge: ChallengeRecord | null = null;
  let afterResolve = false;
  let asked: LineupRecord = { paused: false, questions: [], leftOpen: [] };

  for (const id of EVAL_STEPS) {
    const step = hiringRecipe.steps.find((s) => s.id === id);
    if (step === undefined) throw new Error(`hiring recipe has no step ${id}`);
    current = id;
    // Mirrors applySourceIdentity (src/adapters/d1.ts) before extract: profile keys, then name + employer corroboration
    if (step.kind === "extract") ctx = withSourceIdentity(ctx, orgs);
    known = ctx.sources;
    const out: StepOutcome = await executeStep(step, ctx, ports);
    notes.push(...out.notes.map((x) => `${id}: ${x}`));
    const before = ctx.candidates;
    const have = new Set(ctx.sources.map((s) => s.id));
    ctx = {
      ...ctx,
      sources: [...ctx.sources, ...out.sources.filter((s) => !have.has(s.id))],
      candidates: [...ctx.candidates, ...out.candidates],
      claims: out.claims_mode === "replace" ? out.claims : [...ctx.claims, ...out.claims],
      spent: { usd: ctx.spent.usd + out.cost_usd, calls: ctx.spent.calls + (COLLECTORS.has(step.kind) ? out.calls : 0) },
    };
    if (out.brief !== null) brief = out.brief;
    if (out.challenge !== undefined) challenge = out.challenge;
    if (step.kind === "resolve") {
      afterResolve = true;
      ({ ctx, record: asked } = lineup(p, ctx, orgs, mode));
    }
    if (!COLLECTORS.has(step.kind)) continue;
    // Mirrors ResearchRunWorkflow.doStep + runOne: a skip says why, namesake-only hits say so, else the onEmpty gap
    const allFailed = out.notes.length > 0 && out.notes.every((x) => x.startsWith("request failed") || x === "run budget reached");
    const skipped = out.empty && (out.calls === 0 || allFailed) && out.notes.length > 0 ? out.notes.join("; ") : null;
    let reason: string | null = null;
    if (skipped !== null) reason = `not searched: ${skipped}`;
    else if (afterResolve && noneConfirmed(out.sources, before)) reason = UNCONFIRMED_GAP;
    else if (out.empty && step.onEmpty !== undefined && "gap" in step.onEmpty) reason = step.onEmpty.gap;
    if (reason !== null) ctx = { ...ctx, gaps: [...ctx.gaps, { run_id: runId, question_id: id, reason }] };
  }
  return { subject: ctx.subject, anchor: ctx.anchor, questions: ctx.questions, candidates: [...ctx.candidates], sources: [...ctx.sources], claims: [...ctx.claims], gaps: [...ctx.gaps], brief, challenge, lineup: asked, notes, problems };
}
