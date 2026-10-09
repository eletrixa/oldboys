/**
 * "Confidence in this brief" (plans/014): how far the reader can rely on the brief, measured on the evidence, the identity match
 * and the checks run, computed from RunState. The number is about the document, never about the person.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/trust-box.ts
 * Deps:    src/domain/claim (types), src/domain/confidence (sourceOrigin), src/domain/cz-registry (registryById), src/domain/profile-facts (PLATFORM_LABEL), ./challenge (challengeLine), ./cv-check (cvCounts), ./state (RunState, briefSections, GAP_LABEL)
 * Tested:  src/app/runs/[id]/__tests__/trust-box.test.ts
 *
 * Key responsibilities:
 * - trustBox(state): null without a brief; evidence = the claims the brief shows counted by kind (FACT = quote inside a cited
 *   excerpt, passed the second model and the devil's advocate; INFERENCE; STATEMENT = said in a verification call), the share of
 *   FACTs as a whole %, null with no claims or when AI was off; sources by origin (independent / own / mirror); the devil's
 *   advocate line
 * - identity: "confirmed" (a profile link was supplied or at least one account was merged on a strong link) / "open" (only
 *   accounts awaiting the recruiter's answer) / "none" (nothing linked); counts of accounts theirs / awaiting / someone else;
 *   the distinct reasons the sources were confirmed on
 * - checks: one row per check the run made (Czech registries, CV against the public record, accounts read for signals,
 *   steps searched empty, steps not searched), each with counts in a plain sentence and the question or check it leaves
 *
 * Design constraints:
 * - Pure and deterministic; no model, no I/O, nothing stored; wording describes the research, never the candidate
 *   (every sentence passes JUDGEMENT and ACCUSATION in the test)
 * - A registry record, a CV difference or an account signal is a line with "Ask:" / "Check:", never a deduction from any figure
 */
import type { Brief, Candidate, Claim } from "@/domain/claim";
import { sourceOrigin } from "@/domain/confidence";
import { registryById } from "@/domain/cz-registry";
import { PLATFORM_LABEL } from "@/domain/profile-facts";
import { challengeLine } from "./challenge";
import { cvCounts } from "./cv-check";
import { briefSections, GAP_LABEL, type RunState } from "./state";

export type EvidenceStrip = {
  /** Share of the brief's claims that are verified FACTs, 0..100; null with no claims or when AI was off. */
  pct: number | null;
  facts: number;
  inferences: number;
  statements: number;
  sources: { total: number; independent: number; own: number; mirror: number };
  /** "Devil's advocate: checked 5 findings, 4 held, 1 moved to the interview"; null for runs without the record. */
  challenge: string | null;
  /** Why the figure is missing ("AI was off for this run …"); null when it is shown. */
  unavailable: string | null;
};

export type IdentityStatus = "confirmed" | "open" | "none";

export type IdentityStrip = {
  status: IdentityStatus;
  /** "Identity matched" / "Identity not yet confirmed" / "No profile linked". */
  label: string;
  /** "2 accounts matched · 1 waiting for your answer · 3 ruled out"; zero parts left out. */
  counts: string;
  theirs: number;
  awaiting: number;
  others: number;
  /** Whether the run started from a profile link the recruiter supplied. */
  supplied: boolean;
  /** What the sources were matched on, deduplicated ("name and employer (Revolt, Naveky)"). */
  reasons: string[];
};

export type CheckArea = "registries" | "cv" | "accounts" | "empty" | "not-searched";

export type CheckRow = {
  id: CheckArea;
  label: string;
  /** Counts in a plain sentence: "14 registries searched: 12 no record, 1 record under the name, 1 not available." */
  text: string;
  /** What the row leaves for the reader: "Check: …" / "Ask: …"; null when nothing is open. */
  ask: string | null;
  /** How many items the row leaves for the reader (records to check, differences or signals to ask about); 0 for plain coverage rows. */
  open: number;
  urls: string[];
};

export type TrustBox = {
  evidence: EvidenceStrip;
  identity: IdentityStrip;
  checks: CheckRow[];
};

export const TRUST_BOX_NOTE =
  "These lines measure the evidence we found and the checks we ran, not the person. A registry record, a CV difference or an account signal is a question for the interview, never a deduction.";

/** What "verified fact" means here; printed under the figure. */
export const VERIFIED_MEANS = "A verified fact is a finding whose quote was found in a cited source and that held up against a second model and a devil's advocate.";

const n = (count: number, one: string, many = `${one}s`): string => `${String(count)} ${count === 1 ? one : many}`;

/** Claim ids the brief shows (sections, or per question for older briefs). */
function shownClaims(brief: Brief, claims: readonly Claim[]): Claim[] {
  const sections = briefSections(brief);
  const ids = new Set((sections ?? brief.per_question).flatMap((s) => s.claim_ids));
  const shown = claims.filter((c) => ids.has(c.id));
  // A brief stored before sections may list no claim ids at all; every claim the run kept is then the brief's evidence.
  return shown.length === 0 && ids.size === 0 ? [...claims] : shown;
}

function evidenceStrip(state: RunState, brief: Brief): EvidenceStrip {
  const claims = shownClaims(brief, state.claims);
  const facts = claims.filter((c) => c.kind === "FACT").length;
  const statements = claims.filter((c) => c.kind === "STATEMENT").length;
  const inferences = claims.length - facts - statements;
  const profileUrls = state.candidates.filter((c) => c.decision === "merge").flatMap((c) => c.profile_urls);
  const origins = state.sources.map((s) => sourceOrigin(s.url, profileUrls));
  const sources = {
    total: state.sources.length,
    independent: origins.filter((o) => o === "independent").length,
    own: origins.filter((o) => o === "self").length,
    mirror: origins.filter((o) => o === "mirror").length,
  };
  const unavailable =
    brief.degraded !== null
      ? "AI was off for this run: no finding was read or double-checked by a model, so there is no verified share to show."
      : claims.length === 0
        ? "The brief has no findings to measure."
        : null;
  return {
    pct: unavailable === null ? Math.round((facts / claims.length) * 100) : null,
    facts,
    inferences,
    statements,
    sources,
    challenge: challengeLine(state.challenge_summary),
    unavailable,
  };
}

/** Lineup reasons for the profile the run started from (resolve: "Profile link you supplied"; seed: "profile given by the manager"). */
const SUPPLIED = /you supplied|given by the manager/i;

function identityStrip(state: RunState): IdentityStrip {
  const by = (d: Candidate["decision"]): Candidate[] => state.candidates.filter((c) => c.decision === d);
  const theirs = by("merge");
  const awaiting = by("possibly-same-as").length;
  const others = by("rejected").length;
  const supplied = theirs.some((c) => c.reasons.some((r) => SUPPLIED.test(r)));
  const status: IdentityStatus = theirs.length > 0 ? "confirmed" : awaiting > 0 ? "open" : "none";
  const label = status === "confirmed" ? "Identity matched" : status === "open" ? "Identity not yet confirmed" : "No profile linked";
  const parts = [
    theirs.length > 0 ? `${n(theirs.length, "account")} matched` : "",
    awaiting > 0 ? `${String(awaiting)} waiting for your answer` : "",
    others > 0 ? `${String(others)} ruled out` : "",
  ].filter((p) => p !== "");
  return { status, label, counts: parts.length === 0 ? "No public account was found under this name." : parts.join(" · "), theirs: theirs.length, awaiting, others, supplied, reasons: matchReasons(state.sources) };
}

/**
 * Identity reasons folded by basis: "name and employer match (Revolt)" + "name and employer match (Naveky)" ->
 * "name and employer (Revolt, Naveky)"; other wordings are kept once as written.
 */
export function matchReasons(sources: readonly { identity_reason?: string | null }[]): string[] {
  const byBasis = new Map<string, Set<string>>();
  for (const s of sources) {
    const r = typeof s.identity_reason === "string" ? s.identity_reason.trim() : "";
    if (r === "") continue;
    const m = /^(.+?) match(?: \((.+)\))?$/u.exec(r);
    const basis = m?.[1] ?? r;
    const orgs = byBasis.get(basis) ?? new Set<string>();
    if (m?.[2] !== undefined) orgs.add(m[2]);
    byBasis.set(basis, orgs);
  }
  return [...byBasis].map(([basis, orgs]) => (orgs.size === 0 ? basis : `${basis} (${[...orgs].join(", ")})`));
}

function registryRow(state: RunState): CheckRow | null {
  const checks = state.registry_checks?.checks;
  if (checks === undefined || checks.length === 0) return null;
  const clear = checks.filter((c) => c.status === "clear").length;
  const unavailable = checks.filter((c) => c.status === "unavailable").length;
  const namesakes = checks.reduce((s, c) => s + c.namesakes, 0);
  const hits = checks.filter((c) => c.status === "hits");
  const records = hits.reduce((s, c) => s + c.hits.length, 0);
  const parts = [
    `${String(clear)} no record`,
    records > 0 ? `${n(records, "record")} under the name` : "",
    namesakes > 0 ? `${n(namesakes, "namesake")} left out` : "",
    unavailable > 0 ? `${String(unavailable)} not available` : "",
  ].filter((p) => p !== "");
  const named = hits.map((c) => registryById(c.registry).name).join(", ");
  const nameOnly = hits.some((c) => c.hits.some((h) => h.match === null));
  return {
    id: "registries",
    label: "Czech public registries",
    text: `${n(checks.length, "registry", "registries")} searched by name: ${parts.join(", ")}.`,
    ask: records === 0 ? null : `Check: ${named}, ${nameOnly ? "matched by name only, a namesake is possible" : "matched by city or company"}; confirm at the interview.`,
    open: records,
    urls: hits.flatMap((c) => c.hits.map((h) => h.url)),
  };
}

function cvRow(state: RunState): CheckRow | null {
  const c = cvCounts(state);
  const total = c.matches + c.differs + c["not-found"];
  if (total === 0) return null;
  const parts = [
    `${n(c.matches, "statement matches", "statements match")} the public record`,
    c.differs > 0 ? n(c.differs, "differs", "differ") : "",
    c["not-found"] > 0 ? `${String(c["not-found"])} not found publicly` : "",
  ].filter((p) => p !== "");
  return {
    id: "cv",
    label: "CV against the public record",
    text: `${parts.join(", ")}.`,
    ask: c.differs > 0 ? `Ask: about the ${n(c.differs, "difference")} between the CV and the public record; CVs often round dates or use older titles.` : null,
    open: c.differs,
    urls: [],
  };
}

function accountsRow(state: RunState): CheckRow | null {
  const signals = state.profile_signals;
  if (signals === null || signals === undefined || (signals.checked.length === 0 && signals.signals.length === 0)) return null;
  const platforms = signals.checked.map((p) => PLATFORM_LABEL[p] ?? p);
  const asks = signals.signals.filter((s) => s.ask !== null);
  const read = platforms.length > 0 ? `${n(platforms.length, "account")} read (${platforms.join(", ")})` : "Accounts read";
  const found = signals.signals.length === 0 ? "no account signal" : n(signals.signals.length, "account signal");
  return {
    id: "accounts",
    label: "Public accounts",
    text: `${read}: ${found}${asks.length > 0 ? `, ${n(asks.length, "question")} for the interview` : ""}.`,
    ask: asks.length === 0 ? null : `Ask: ${asks[0]?.ask ?? ""}`,
    open: asks.length,
    urls: asks.map((s) => s.source_url),
  };
}

const gapLabel = (source: string): string => GAP_LABEL[source] ?? source;

function emptyRow(brief: Brief): CheckRow | null {
  const empty = brief.searched_empty.filter((g) => g.source !== "cv-consistency");
  if (empty.length === 0) return null;
  const names = [...new Set(empty.map((g) => gapLabel(g.source)))];
  return { id: "empty", label: "Searched, nothing found", text: `${n(empty.length, "source")} answered with nothing for this person: ${names.join(", ")}.`, ask: null, open: 0, urls: [] };
}

function notSearchedRow(brief: Brief): CheckRow | null {
  if (brief.not_searched.length === 0) return null;
  const names = [...new Set(brief.not_searched.map((g) => gapLabel(g.source)))];
  return { id: "not-searched", label: "Not searched", text: `${n(brief.not_searched.length, "source")} not searched: ${names.join(", ")}.`, ask: null, open: 0, urls: [] };
}

export function trustBox(state: RunState): TrustBox | null {
  const brief = state.brief;
  if (brief === null) return null;
  const checks = [registryRow(state), cvRow(state), accountsRow(state), emptyRow(brief), notSearchedRow(brief)].filter((r): r is CheckRow => r !== null);
  return { evidence: evidenceStrip(state, brief), identity: identityStrip(state), checks };
}

/** "11 facts, 3 inferences, 1 statement": what the figure was counted over. */
export function evidenceLabel(e: EvidenceStrip): string {
  return [n(e.facts, "fact"), n(e.inferences, "inference"), e.statements > 0 ? n(e.statements, "statement") : ""].filter((p) => p !== "").join(", ");
}

/** "9 sources: 4 independent, 4 own profiles, 1 directory copy". */
export function sourcesLabel(s: EvidenceStrip["sources"]): string {
  if (s.total === 0) return "No source was kept.";
  const parts = [
    s.independent > 0 ? `${String(s.independent)} independent` : "",
    s.own > 0 ? `${String(s.own)} own ${s.own === 1 ? "profile" : "profiles"}` : "",
    s.mirror > 0 ? `${String(s.mirror)} directory ${s.mirror === 1 ? "copy" : "copies"}` : "",
  ].filter((p) => p !== "");
  return `${n(s.total, "source")}: ${parts.join(", ")}`;
}
