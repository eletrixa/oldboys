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
 * - `markdown()` renders eval/RESULTS.md
 *
 * Design constraints:
 * - Scores the research pipeline, never a candidate; never tunes the truth to the result
 */
import type { Claim } from "@/domain/claim";
import { cvOutcome, isCvSource } from "@/domain/cv-check";
import { quoteInExcerpt } from "@/domain/quote";
import { profileKey } from "@/recipe/seams/resolve";
import type { PipelineResult } from "./harness";
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

export type EvalReport = {
  headline: { passed: number; total: number; unsafe_misses: number; conservative_misses: number };
  personas: { id: string; title: string; passed: number; total: number }[];
  by_category: { category: CheckCategory; label: string; passed: number; total: number }[];
  misses: Omit<Check, "pass">[];
  checks: Check[];
};

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
    if (prof.person) {
      const kept = cand !== undefined && cand.decision !== "rejected";
      add("identity", `Own profile kept (merged or asked): ${prof.note}`, kept, kept ? `decision ${cand.decision}` : `decision ${cand?.decision ?? "no candidate"}`, "conservative");
      continue;
    }
    const merged = cand?.decision === "merge";
    add("identity", `Namesake not merged: ${prof.note}`, !merged, merged ? `merged with score ${String(cand.score)} (${cand.reasons.join("; ")})` : `decision ${cand?.decision ?? "not a candidate"}`);
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

export function summarize(scores: readonly PersonaScore[]): EvalReport {
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

export const CATEGORY_LABEL: Record<CheckCategory, string> = {
  identity: "Identity (namesakes)",
  "false-fact": "Traps caught (no false FACT)",
  "true-fact": "True findings kept",
  "must-have": "Must-have coverage",
  "honest-gap": "Honest gaps",
  invariant: "FACT invariants",
};

export function markdown(report: EvalReport): string {
  const h = report.headline;
  const lines = [
    "# Eval results",
    "",
    "Generated by `pnpm eval` (eval/run.ts). Do not edit by hand.",
    "",
    `**Caught ${String(h.passed)} of ${String(h.total)} checks** on 5 synthetic personas. Misses: ${String(h.unsafe_misses)} unsafe (the brief shows something false), ${String(h.conservative_misses)} conservative (the brief holds back something true).`,
    "",
    "The personas are fictional. Search results, scraped pages and every model answer are recorded, so this measures the pipeline's rules and wiring (identity, quote checks, verify, devil's advocate, gaps), not the live model's judgement.",
    "",
    "## Per persona",
    "",
    "| Persona | What it tests | Checks passed |",
    "|---|---|---|",
    ...report.personas.map((p) => `| ${p.id} | ${p.title} | ${String(p.passed)} / ${String(p.total)} |`),
    "",
    "## Per category",
    "",
    "| Category | Passed |",
    "|---|---|",
    ...report.by_category.map((c) => `| ${c.label} | ${String(c.passed)} / ${String(c.total)} |`),
    "",
    "## Misses",
    "",
    ...(report.misses.length === 0
      ? ["None."]
      : ["| Persona | Severity | Check | What happened |", "|---|---|---|---|", ...report.misses.map((m) => `| ${m.persona} | ${m.severity} | ${m.label.replaceAll("|", "\\|")} | ${m.detail.replaceAll("|", "\\|")} |`)]),
    "",
  ];
  return lines.join("\n");
}
