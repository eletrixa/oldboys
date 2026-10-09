/**
 * Eval scoring: compares one pipeline result with the persona's written ground truth and sums the eval set.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/score.ts
 * Deps:    src/domain/cv-check (cvOutcome), src/domain/quote, src/recipe/seams/resolve (profileKey)
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - One check per truth line: identity (namesake not merged, own profile kept, namesake pages never evidence),
 *   claim outcome (FACT / to verify / not in the brief, CV outcome), must-have coverage and whether an open must-have
 *   reaches the interview, stated gaps, degraded brief, plus two invariants (a FACT cites only confirmed sources and
 *   its quote is inside one of them)
 * - Each miss carries a plain reason and a severity: `unsafe` (the brief shows something false or a namesake) or
 *   `conservative` (the brief holds back something true); the headline counts both
 * - Two modes from the same checks: "recruiter" (a simulated recruiter answers the lineup from the ground truth, the
 *   product as designed; the headline) and "strict" (nobody answers, possibly-same-as stays unmerged)
 * - `lineupReport`: the lineup questions the product asks (own / namesake / not in the truth), the cost of the strict
 *   identity rule
 * - `markdown()` renders eval/RESULTS.md
 *
 * Design constraints:
 * - Scores the research pipeline, never a candidate; never tunes the truth to the result
 */
import type { Claim } from "@/domain/claim";
import { cvOutcome, isCvSource } from "@/domain/cv-check";
import { quoteInExcerpt } from "@/domain/quote";
import { profileKey } from "@/recipe/seams/resolve";
import type { LineupQuestion, PipelineResult } from "./harness";
import type { Persona } from "./persona";

export type CheckCategory = "identity" | "false-fact" | "true-fact" | "must-have" | "honest-gap" | "invariant";

export type Check = {
  persona: string;
  category: CheckCategory;
  label: string;
  pass: boolean;
  /** What happened, in plain words (filled for misses, short for passes). */
  detail: string;
  severity: "unsafe" | "conservative";
};

export type PersonaScore = { id: string; title: string; passed: number; total: number; checks: Check[] };

/** The score of one mode. */
export type ModeReport = {
  headline: { passed: number; total: number; unsafe_misses: number; conservative_misses: number };
  personas: { id: string; title: string; passed: number; total: number }[];
  by_category: { category: CheckCategory; label: string; passed: number; total: number }[];
  misses: Omit<Check, "pass">[];
  checks: Check[];
};

/** Lineup questions the product asks ("is this the same person?"); `left_open`: possibly-same-as beyond the cap. */
export type LineupReport = {
  asked: number;
  own: number;
  namesake: number;
  unknown: number;
  paused_runs: number;
  left_open: number;
  personas: { id: string; paused: boolean; questions: LineupQuestion[]; left_open: string[] }[];
};

/** Top level = the simulated-recruiter mode (headline); `strict` = the same checks with no lineup answer. */
export type EvalReport = ModeReport & { mode: "simulated-recruiter"; lineup: LineupReport; strict: ModeReport };

/** Why a profile is still possibly-same-as after the lineup: no pause, asked without an answer, or beyond the cap. */
function openReason(r: PipelineResult, asked: boolean): string {
  if (!r.lineup.paused) return "possibly-same-as; the run does not pause for the lineup (a given profile or CV settles identity), so it stays unmerged";
  if (asked) return "asked in the lineup; nobody answers in strict mode, so it stays unmerged";
  return "possibly-same-as; not among the lineup's questions (at most 3), so it stays unmerged";
}

const fold = (t: string): string => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function findClaim(r: PipelineResult, text: string): Claim | undefined {
  return r.claims.find((c) => c.text === text || c.text.startsWith(`${text} `));
}

export function scorePersona(p: Persona, r: PipelineResult): PersonaScore {
  const checks: Check[] = [];
  const add = (category: CheckCategory, label: string, pass: boolean, detail: string, severity: Check["severity"] = "unsafe"): void => {
    checks.push({ persona: p.id, category, label, pass, detail, severity });
  };
  const brief = r.brief;
  const confirmedIds = new Set(r.sources.filter((s) => s.identity === "merged").map((s) => s.id));
  const evidenceUrls = new Set((brief?.evidence ?? []).map((e) => profileKey(e.url)));
  const inBrief = new Set((brief?.per_question ?? []).flatMap((q) => q.claim_ids));
  const toVerify = brief?.to_verify ?? [];
  const asked = [...(brief?.interview_questions ?? []), ...toVerify].map(fold);

  for (const prof of p.truth.profiles) {
    const key = profileKey(prof.url);
    const cand = r.candidates.find((c) => c.profile_urls.some((u) => profileKey(u) === key));
    const question = r.lineup.questions.find((q) => profileKey(q.url) === key);
    const reply = question?.answer ?? null;
    const byRecruiter = reply === null ? "" : ` on the simulated recruiter's ${reply === "merge" ? "yes" : reply === "rejected" ? "no" : "not sure"}`;
    if (prof.person) {
      const kept = cand !== undefined && cand.decision !== "rejected";
      const open = reply === null ? openReason(r, question !== undefined) : `possibly-same-as${byRecruiter}`;
      const detail = cand?.decision === "possibly-same-as" ? open : `decision ${cand?.decision ?? "no candidate"}${byRecruiter}`;
      add("identity", `Own profile kept (merged or asked): ${prof.note}`, kept, detail, "conservative");
      continue;
    }
    const merged = cand?.decision === "merge";
    add("identity", `Namesake not merged: ${prof.note}`, !merged, merged ? `merged with score ${String(cand.score)} (${cand.reasons.join("; ")})` : `decision ${cand?.decision ?? "not a candidate"}${byRecruiter}`);
    const leaked = r.sources.filter((s) => profileKey(s.url) === key || s.url.startsWith(prof.url.replace(/\/$/, "") + "/"));
    const used = leaked.filter((s) => s.identity === "merged" || evidenceUrls.has(profileKey(s.url)));
    add("identity", `Namesake pages never confirmed evidence: ${prof.note}`, used.length === 0, used.length === 0 ? "kept out of the evidence" : `confirmed as evidence: ${used.map((s) => s.url).join(", ")}`);
  }

  const cvIds = new Set(r.sources.filter(isCvSource).map((s) => s.id));
  for (const t of p.truth.claims) {
    const c = findClaim(r, t.text);
    const label = `${t.trap ?? "True finding"}: "${t.text}"`;
    const state = c === undefined ? "dropped" : `${c.kind}${inBrief.has(c.id) ? ", in the brief" : ""}${toVerify.includes(c.text) ? ", under To verify" : ""}`;
    if (t.expect === "fact") {
      add("true-fact", label, c?.kind === "FACT", c?.kind === "FACT" ? "kept as FACT" : `ended ${state}`, "conservative");
    } else if (t.expect === "to-verify") {
      const ok = c !== undefined && c.kind !== "FACT" && toVerify.includes(c.text);
      add("false-fact", label, ok, ok ? "moved to To verify" : `ended ${state}`, c?.kind === "FACT" ? "unsafe" : "conservative");
    } else if (t.expect === "not-fact") {
      add("false-fact", label, c?.kind !== "FACT", c?.kind === "FACT" ? `ended ${state}` : `not a FACT (${state})`);
    } else {
      const ok = c === undefined || (c.kind !== "FACT" && !inBrief.has(c.id) && !toVerify.includes(c.text));
      add("false-fact", label, ok, ok ? `not shown (${state})` : `ended ${state}`);
    }
    if (t.cvOutcome !== undefined) {
      const got = c === undefined ? "dropped" : cvOutcome(c, cvIds);
      add("false-fact", `CV check shows "${t.cvOutcome}": "${t.text}"`, got === t.cvOutcome, `shown as "${got}"`, "conservative");
    }
  }

  for (const [qid, mh] of Object.entries(p.truth.mustHaves)) {
    const coverage = brief?.per_question.find((q) => q.question_id === qid)?.coverage ?? "none";
    const evidenced = coverage === "evidenced";
    const word = fold(mh.keyword);
    if (mh.evidenced) {
      add("must-have", `Must-have evidenced: ${qid}`, evidenced, `coverage ${coverage}`, "conservative");
      const needless = (brief?.interview_questions ?? []).some((q) => fold(q).includes(word));
      add("must-have", `No interview question for the evidenced ${qid}`, !needless, needless ? "asked anyway" : "not asked", "conservative");
    } else {
      add("must-have", `Must-have not shown as evidenced: ${qid}`, !evidenced, `coverage ${coverage}`);
      const reaches = asked.some((q) => q.includes(word));
      add("honest-gap", `Open must-have reaches the interview: ${qid}`, reaches, reaches ? "interview question or To verify item" : `no interview question or To verify item mentions "${mh.keyword}"`, "conservative");
    }
  }

  for (const stepId of p.truth.gaps) {
    const stated = [...(brief?.searched_empty ?? []), ...(brief?.not_searched ?? [])].find((g) => g.source === stepId);
    add("honest-gap", `Gap stated: ${stepId}`, stated !== undefined, stated?.reason ?? "missing from the brief", "conservative");
  }
  for (const kw of p.truth.interviewAbout ?? []) {
    const hit = (brief?.interview_questions ?? []).some((q) => fold(q).includes(fold(kw)));
    add("honest-gap", `Interview question about "${kw}"`, hit, hit ? "asked" : "no question", "conservative");
  }
  if (p.truth.degraded === true) {
    const ok = brief !== null && brief.degraded !== null && brief.evidence.length > 0;
    add("honest-gap", "Degraded brief says the AI summary is unavailable and still links evidence", ok, brief?.degraded ?? "not degraded");
  }

  const facts = r.claims.filter((c) => c.kind === "FACT");
  const unconfirmed = facts.filter((c) => c.supports.some((id) => !confirmedIds.has(id)));
  add("invariant", "Every FACT cites only confirmed sources", unconfirmed.length === 0, unconfirmed.length === 0 ? `${String(facts.length)} FACTs` : unconfirmed.map((c) => c.text).join("; "));
  const byId = new Map(r.sources.map((s) => [s.id, s]));
  const unquoted = facts.filter((c) => c.quote === null || !c.supports.some((id) => quoteInExcerpt(c.quote ?? "", byId.get(id)?.excerpt ?? "")));
  add("invariant", "Every FACT quote is inside a cited excerpt", unquoted.length === 0, unquoted.length === 0 ? `${String(facts.length)} FACTs` : unquoted.map((c) => c.text).join("; "));

  return { id: p.id, title: p.title, passed: checks.filter((c) => c.pass).length, total: checks.length, checks };
}

const CATEGORIES: CheckCategory[] = ["identity", "false-fact", "true-fact", "must-have", "honest-gap", "invariant"];

export function summarize(scores: readonly PersonaScore[]): ModeReport {
  const checks = scores.flatMap((s) => s.checks);
  const misses = checks.filter((c) => !c.pass).map(({ pass: _pass, ...rest }) => rest);
  const by = (cat: CheckCategory) => {
    const cs = checks.filter((c) => c.category === cat);
    return { passed: cs.filter((c) => c.pass).length, total: cs.length };
  };
  return {
    headline: {
      passed: checks.filter((c) => c.pass).length,
      total: checks.length,
      unsafe_misses: misses.filter((m) => m.severity === "unsafe").length,
      conservative_misses: misses.filter((m) => m.severity === "conservative").length,
    },
    personas: scores.map(({ id, title, passed, total }) => ({ id, title, passed, total })),
    by_category: CATEGORIES.map((c) => ({ category: c, label: CATEGORY_LABEL[c], ...by(c) })),
    misses,
    checks,
  };
}

export function lineupReport(runs: readonly { id: string; lineup: PipelineResult["lineup"] }[]): LineupReport {
  const questions = runs.flatMap((r) => r.lineup.questions);
  const count = (t: LineupQuestion["truth"]): number => questions.filter((q) => q.truth === t).length;
  return {
    asked: questions.length,
    own: count("own"),
    namesake: count("namesake"),
    unknown: count("unknown"),
    paused_runs: runs.filter((r) => r.lineup.paused).length,
    left_open: runs.reduce((n, r) => n + r.lineup.leftOpen.length, 0),
    personas: runs.map((r) => ({ id: r.id, paused: r.lineup.paused, questions: r.lineup.questions, left_open: r.lineup.leftOpen })),
  };
}

export const CATEGORY_LABEL: Record<CheckCategory, string> = {
  identity: "Identity (namesakes)",
  "false-fact": "Traps caught (no false FACT)",
  "true-fact": "True findings kept",
  "must-have": "Must-have coverage",
  "honest-gap": "Honest gaps",
  invariant: "FACT invariants",
};

const TRUTH_WORD: Record<LineupQuestion["truth"], string> = { own: "own profile", namesake: "namesake", unknown: "not in the ground truth" };
const ANSWER_WORD: Record<string, string> = { merge: "yes", rejected: "no", "possibly-same-as": "not sure" };

const score = (h: ModeReport["headline"]): string =>
  `${String(h.passed)} of ${String(h.total)} checks (${String(h.unsafe_misses)} unsafe, ${String(h.conservative_misses)} conservative misses)`;

function missTable(misses: ModeReport["misses"]): string[] {
  if (misses.length === 0) return ["None."];
  return ["| Persona | Severity | Check | What happened |", "|---|---|---|---|", ...misses.map((m) => `| ${m.persona} | ${m.severity} | ${m.label.replaceAll("|", "\\|")} | ${m.detail.replaceAll("|", "\\|")} |`)];
}

/** How the lineup works and what the simulated recruiter may answer (RESULTS.md and /validation say the same). */
export const LINEUP_TEXT =
  "A profile merges on its own only on a strong link (the given profile, a confirmed employer, a cross-link), never on name + city; a weaker match stays \"possibly the same person\" and its pages are not used. The run pauses for the recruiter's lineup answer (\"is this the same person?\", at most 3 questions, one per platform) only when nothing is confirmed; a run started from a profile or CV never pauses. The eval's recruiter is simulated: where the product asks, it answers from the hand-written ground truth (own profile: yes, namesake: no) and is always right; a real recruiter can be wrong. It never answers where the product does not ask, nor over a profile the product merged or rejected on its own. The strict score is the same run with no answer.";

/** Shown when no persona run pauses: the two scores are the same by construction. */
export const NO_PAUSE_TEXT =
  "Every persona starts from a LinkedIn profile or a CV, so no run pauses and the simulated recruiter answers nothing: both scores are the same. The person's own profiles found only by name + city stay unused; that is the cost of the safer identity rule here.";

export function markdown(report: EvalReport): string {
  const h = report.headline;
  const s = report.strict;
  const l = report.lineup;
  const strictOf = new Map(s.personas.map((p) => [p.id, p]));
  const strictCat = new Map(s.by_category.map((c) => [c.category, c]));
  const lineupOf = new Map(l.personas.map((p) => [p.id, p]));
  const lines = [
    "# Eval results",
    "",
    "Generated by `pnpm eval` (eval/run.ts). Do not edit by hand.",
    "",
    `**Caught ${score(h)}** on 5 synthetic personas, with a simulated recruiter answering the identity lineup (the product as designed). Unsafe: the brief shows something false; conservative: the brief holds back something true.`,
    "",
    `**Strict, nobody answers the lineup: ${score(s.headline)}.**`,
    "",
    `**Lineup questions asked: ${String(l.asked)}** (${String(l.own)} own profile, ${String(l.namesake)} namesake, ${String(l.unknown)} not in the ground truth); ${String(l.paused_runs)} of ${String(l.personas.length)} runs pause for the lineup${l.left_open === 0 ? "" : `; ${String(l.left_open)} "possibly the same person" ${l.left_open === 1 ? "profile" : "profiles"} beyond the 3-question cap not asked`}.`,
    "",
    LINEUP_TEXT,
    "",
    ...(l.paused_runs === 0 ? [NO_PAUSE_TEXT, ""] : []),
    "The personas are fictional. Search results, scraped pages and every model answer are recorded, so this measures the pipeline's rules and wiring (identity, quote checks, verify, devil's advocate, gaps), not the live model's judgement.",
    "",
    "## Per persona",
    "",
    "| Persona | What it tests | With the simulated recruiter | Strict | Lineup questions |",
    "|---|---|---|---|---|",
    ...report.personas.map((p) => {
      const st = strictOf.get(p.id);
      const q = lineupOf.get(p.id)?.questions ?? [];
      return `| ${p.id} | ${p.title} | ${String(p.passed)} / ${String(p.total)} | ${st === undefined ? "-" : `${String(st.passed)} / ${String(st.total)}`} | ${String(q.length)} |`;
    }),
    "",
    "## Lineup questions",
    "",
    ...(l.asked === 0
      ? ["None."]
      : [
          "| Persona | Profile | Truth | Simulated answer |",
          "|---|---|---|---|",
          ...l.personas.flatMap((p) => p.questions.map((q) => `| ${p.id} | ${q.platform}: ${q.note} | ${TRUTH_WORD[q.truth]} | ${q.answer === null ? "-" : (ANSWER_WORD[q.answer] ?? q.answer)} |`)),
        ]),
    ...(l.left_open === 0 ? [] : ["", `Not asked (beyond the cap, stay unmerged): ${l.personas.flatMap((p) => p.left_open.map((u) => `${p.id}: ${u}`)).join(", ")}.`]),
    "",
    "## Per category",
    "",
    "| Category | With the simulated recruiter | Strict |",
    "|---|---|---|",
    ...report.by_category.map((c) => {
      const st = strictCat.get(c.category);
      return `| ${c.label} | ${String(c.passed)} / ${String(c.total)} | ${st === undefined ? "-" : `${String(st.passed)} / ${String(st.total)}`} |`;
    }),
    "",
    "## Misses with the simulated recruiter",
    "",
    ...missTable(report.misses),
    "",
    "## Misses in strict mode (nobody answers the lineup)",
    "",
    ...missTable(s.misses),
    "",
  ];
  return lines.join("\n");
}
