/**
 * Role-fit scorecard (plans/013): the share of the hiring role's must-haves with public evidence, and every plus and
 * minus the run found, each with its evidence and its effect on that number. Computed from RunState, no model.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/scorecard.ts
 * Deps:    src/domain/claim (types), src/domain/cz-registry (registryById), src/domain/profile-signals (type), ./cv-check (cvRows, isCvSection), ./challenge (challengeReason), ./state (RunState, hiringFor)
 * Tested:  src/app/runs/[id]/__tests__/scorecard.test.ts
 *
 * Key responsibilities:
 * - fitPct: Σ(weight × status) ÷ Σ(weight) × 100 (has 1, partial 0.5, none 0); Σ weight 0 falls back to the stored fit_pct.
 *   Shared with the Fit section so the card and section 5 print the same number
 * - scorecard(state): null without a brief; fit from the hiring role's position_fit traits, else from per_question
 *   `mh-*` coverage (weight 1), null when there are no must-haves; pluses (must-haves with evidence, partly evidenced
 *   must-haves, achievements with an independent line, CV matches), minuses (must-haves without evidence, risks, CV
 *   differences, challenged claims, registry records: attributed ones listed (REGISTRY_LISTED per registry), name-only ones as one
 *   summary line per registry; account signals with a question),
 *   notes (steps not searched or empty, AI off)
 * - Points: a must-have's share of 100, signed; every other line carries 0 ("no effect on fit"); a must-have whose only
 *   evidence is the CV carries CV_ONLY in its text
 * - Shared wording for the card and the text export: askLine, pointsLabel, checkedLabel, hasScorecard, SCORECARD_NOTE
 *
 * Design constraints:
 * - Pure and deterministic; the only number is evidence coverage of the role profile, never a score of the person:
 *   risks, registry records, CV differences and signals are open points (ask or check), never deductions
 * - Confirmed data only: profile evidence, attributed registry hits, merged-account signals; also_found never enters
 * - Every text comes from the run's own wording (trait, risk heading, claim text, registry label, signal sentence),
 *   so the JUDGEMENT / ACCUSATION guard in challenge.ts holds here as there
 */
import type { Brief, PositionFit, Profile, ProfileEvidence, ProfileItem } from "@/domain/claim";
import { registryById } from "@/domain/cz-registry";
import { challengeReason } from "./challenge";
import { cvRows, isCvSection } from "./cv-check";
import { hiringFor, isCvSource, type RunState } from "./state";

type ScoreSide = "plus" | "minus";
type ScoreArea = "must-have" | "achievement" | "risk" | "cv" | "challenge" | "registry" | "signal";
/** FACT / INFERENCE as the evidence says; CHECK = a script result (CV comparison, registry search, account facts). */
export type ScoreKind = "FACT" | "INFERENCE" | "CHECK";

export type ScoreItem = {
  id: string;
  side: ScoreSide;
  area: ScoreArea;
  text: string;
  kind: ScoreKind;
  /** Effect on the fit figure in points of 100, signed; 0 outside the must-haves. */
  points: number;
  /** Source ids of the evidence lines (profile evidence, claim supports); resolved to links by the card. */
  source_ids: string[];
  /** Direct links when the input carries them (registry record, signal source). */
  urls: string[];
  /** Interview question or check for the line; null when the line stands alone. */
  ask: string | null;
};

export type Scorecard = {
  /** 0..100, or null when the run has no must-haves to score. */
  fit: number | null;
  role: string | null;
  checked: { evidenced: number; partial: number; none: number; total: number };
  pluses: ScoreItem[];
  minuses: ScoreItem[];
  notes: string[];
};

const STATUS_SCORE: Record<"has" | "partial" | "none", number> = { has: 1, partial: 0.5, none: 0 };

/** Σ(weight × status) ÷ Σ(weight), as a whole %; the stored fit_pct when no capability carries weight. */
export function fitPct(f: Pick<PositionFit, "traits" | "fit_pct">): number {
  const total = f.traits.reduce((s, t) => s + t.weight, 0);
  if (total === 0) return f.fit_pct;
  return Math.round((f.traits.reduce((s, t) => s + t.weight * STATUS_SCORE[t.status], 0) / total) * 100);
}

type Trait = { trait: string; status: "has" | "partial" | "none"; weight: number; evidence: ProfileEvidence[] };

/** The hiring role's fit card (matched by name, else the first), as traits. */
function mainFit(profile: Profile | null, role: string | null): PositionFit | null {
  if (profile === null || profile.position_fit.length === 0) return null;
  const want = role?.trim().toLowerCase();
  return profile.position_fit.find((f) => f.role.trim().toLowerCase() === want) ?? profile.position_fit[0] ?? null;
}

const COVERAGE_STATUS = { evidenced: "has", partial: "partial", none: "none" } as const;

/** Must-haves without a profile: `mh-*` rows of the brief, weight 1, the question text as the trait. */
function coverageTraits(state: RunState, brief: Brief): Trait[] {
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  return brief.per_question
    .filter((q) => q.question_id.startsWith("mh-"))
    .map((q) => ({ trait: textOf.get(q.question_id) ?? q.summary, status: COVERAGE_STATUS[q.coverage], weight: 1, evidence: [] }));
}

const direction = (e: ProfileEvidence): "supports" | "contradicts" | "context" => e.direction ?? (e.supports ? "supports" : "contradicts");
const supporting = (lines: readonly ProfileEvidence[]): ProfileEvidence[] => lines.filter((e) => direction(e) === "supports");
const kindOf = (lines: readonly ProfileEvidence[]): ScoreKind => (lines.some((e) => e.kind === "FACT") ? "FACT" : "INFERENCE");
const sourceIds = (lines: readonly ProfileEvidence[]): string[] => [...new Set(lines.map((e) => e.source_id))];

/** Whole points of 100 a weight carries (a partial passes half its weight); the unrounded shares are what the fit figure sums. */
function share(weight: number, total: number): number {
  return total === 0 ? 0 : Math.round((weight / total) * 100);
}

/** "Ask: …" unless the producer already wrote a "Check: …" line. */
export function askLine(ask: string): string {
  return ask.startsWith("Check:") ? ask : `Ask: ${ask}`;
}

/** "+14 pts", "−14 pts" or "no effect on fit". */
export function pointsLabel(points: number): string {
  if (points === 0) return "no effect on fit";
  return `${points > 0 ? "+" : "\u2212"}${String(Math.abs(points))} pts`;
}

/** "3 of 5 must-haves evidenced, 1 partly" / "no must-haves to score". */
export function checkedLabel(c: Scorecard["checked"]): string {
  if (c.total === 0) return "no must-haves to score";
  const partly = c.partial > 0 ? `, ${String(c.partial)} partly` : "";
  return `${String(c.evidenced)} of ${String(c.total)} must-have${c.total === 1 ? "" : "s"} evidenced${partly}`;
}

/** A card worth showing: a figure or at least one line. */
export function hasScorecard(card: Scorecard | null): card is Scorecard {
  return card !== null && (card.fit !== null || card.pluses.length > 0 || card.minuses.length > 0);
}

/** Suffix of a must-have line whose only evidence is the candidate's own CV. */
export const CV_ONLY = "from the CV only";

function mustHaveItems(traits: readonly Trait[], fromCoverage: boolean, isCv: (sourceId: string) => boolean): ScoreItem[] {
  const total = traits.reduce((s, t) => s + t.weight, 0);
  return traits.map((t, i) => {
    const pts = share(t.weight, total);
    const lines = supporting(t.evidence);
    const ids = sourceIds(lines);
    const base = { id: `mh-${String(i)}`, area: "must-have" as const, source_ids: ids, urls: [], ask: null };
    const kind: ScoreKind = fromCoverage ? "CHECK" : t.evidence.length === 0 ? "INFERENCE" : kindOf(lines);
    // A must-have resting on the CV alone is self-reported: said so in the line, never hidden behind "FACT".
    const cvOnly = ids.length > 0 && ids.every(isCv) ? `, ${CV_ONLY}` : "";
    if (t.status === "has") return { ...base, side: "plus", text: `${t.trait}${cvOnly}`, kind, points: pts };
    if (t.status === "partial") return { ...base, side: "plus", text: `${t.trait}, partly evidenced${cvOnly}`, kind, points: share(t.weight / 2, total) };
    return { ...base, side: "minus", text: `${t.trait}: no public evidence`, kind: "CHECK", points: -pts };
  });
}

/** Achievements with at least one independent (strong) supporting line; self-reported ones stay in the profile section. */
function achievementItems(items: readonly ProfileItem[]): ScoreItem[] {
  return items.flatMap((a, i) => {
    const strong = supporting(a.evidence).filter((e) => e.strength === "strong");
    if (strong.length === 0) return [];
    return [{ id: `ach-${String(i)}`, side: "plus" as const, area: "achievement" as const, text: a.text, kind: kindOf(strong), points: 0, source_ids: sourceIds(strong), urls: [], ask: null }];
  });
}

function riskItems(profile: Profile): ScoreItem[] {
  return profile.risks.map((r, i) => {
    const lines = r.evidence;
    const closes = profile.questions.find((q) => q.closes.trim().toLowerCase() === r.text.trim().toLowerCase());
    return { id: `risk-${String(i)}`, side: "minus", area: "risk", text: r.text, kind: lines.length === 0 ? "INFERENCE" : kindOf(lines), points: 0, source_ids: sourceIds(lines), urls: [], ask: closes?.text ?? null };
  });
}

function cvItems(state: RunState): ScoreItem[] {
  const brief = state.brief;
  if (brief === null) return [];
  const ids = new Set(brief.per_question.find((q) => isCvSection(q.question_id))?.claim_ids ?? []);
  const rows = cvRows(state.claims.filter((c) => ids.has(c.id)), state.sources);
  const matches = rows.filter((r) => r.outcome === "matches").length;
  const differs = rows.filter((r) => r.outcome === "differs");
  const items: ScoreItem[] = differs.map((r, i) => ({
    id: `cv-${String(i)}`,
    side: "minus",
    area: "cv",
    text: r.claim.text,
    kind: "CHECK",
    points: 0,
    source_ids: [...r.claim.supports, ...r.claim.contradicts],
    urls: [],
    ask: "Ask about the difference between the CV and the public record here.",
  }));
  if (matches > 0) {
    items.unshift({
      id: "cv-matches",
      side: "plus",
      area: "cv",
      text: `${String(matches)} CV ${matches === 1 ? "statement matches" : "statements match"} the public record`,
      kind: "CHECK",
      points: 0,
      source_ids: [],
      urls: [],
      ask: null,
    });
  }
  return items;
}

function challengeItems(state: RunState): ScoreItem[] {
  const byId = new Map(state.claims.map((c) => [c.id, c]));
  return (state.challenges ?? []).flatMap((ch, i) => {
    const claim = byId.get(ch.claim_id);
    if (claim === undefined) return [];
    return [{ id: `ch-${String(i)}`, side: "minus" as const, area: "challenge" as const, text: claim.text, kind: "INFERENCE" as const, points: 0, source_ids: claim.supports, urls: [], ask: challengeReason(ch) }];
  });
}

/** Attributed records (city or company match) listed one by one, at most this many per registry; name-only records are one summary line. */
const REGISTRY_LISTED = 3;

function registryItems(state: RunState): ScoreItem[] {
  return (state.registry_checks?.checks ?? []).flatMap((check) => {
    if (check.status !== "hits") return [];
    const name = registryById(check.registry).name;
    const matched = check.hits.filter((h) => h.match !== null);
    const nameOnly = check.hits.length - matched.length;
    const listed = matched.slice(0, REGISTRY_LISTED).map((h, i) => ({
      id: `reg-${check.registry}-${String(i)}`,
      side: "minus" as const,
      area: "registry" as const,
      text: `${name}: ${h.label}`,
      kind: "CHECK" as const,
      points: 0,
      source_ids: [],
      urls: [h.url],
      ask: `Check: matched by ${h.match ?? ""}.`,
    }));
    const rest = matched.length - listed.length + nameOnly;
    if (rest === 0) return listed;
    const total = check.total !== null && check.total > check.hits.length ? check.total : check.hits.length;
    const what = listed.length === 0 ? `${String(total)} ${total === 1 ? "record" : "records"} under this name` : `${String(rest)} more ${rest === 1 ? "record" : "records"} under this name`;
    return [
      ...listed,
      {
        id: `reg-${check.registry}-rest`,
        side: "minus" as const,
        area: "registry" as const,
        text: `${name}: ${what}`,
        kind: "CHECK" as const,
        points: 0,
        source_ids: [],
        urls: [check.source_url],
        ask: nameOnly > 0 ? "Check: name match only, a namesake is possible; the registry search is linked." : "Check: the registry search is linked.",
      },
    ];
  });
}

function signalItems(state: RunState): ScoreItem[] {
  return (state.profile_signals?.signals ?? []).flatMap((s, i) =>
    s.ask === null ? [] : [{ id: `sig-${String(i)}`, side: "minus" as const, area: "signal" as const, text: s.text, kind: "CHECK" as const, points: 0, source_ids: [], urls: [s.source_url], ask: s.ask }],
  );
}

function notes(brief: Brief): string[] {
  const out: string[] = [];
  if (brief.degraded !== null) out.push("AI was off for this run: must-haves were not read against the sources.");
  const empty = brief.searched_empty.filter((g) => !isCvSection(g.source)).length;
  if (empty > 0) out.push(`${String(empty)} ${empty === 1 ? "source was" : "sources were"} searched and came back empty.`);
  if (brief.not_searched.length > 0) out.push(`${String(brief.not_searched.length)} ${brief.not_searched.length === 1 ? "source was" : "sources were"} not searched.`);
  return out;
}

export function scorecard(state: RunState): Scorecard | null {
  const brief = state.brief;
  if (brief === null) return null;
  const role = hiringFor(state);
  const fit = mainFit(brief.profile, role);
  const traits: Trait[] = fit?.traits ?? coverageTraits(state, brief);
  const cvIds = new Set(state.sources.filter((src) => isCvSource(src.url)).map((src) => src.id));
  const items = [
    ...mustHaveItems(traits, fit === null, (id) => cvIds.has(id)),
    ...achievementItems(brief.profile?.achievements ?? []),
    ...(brief.profile === null ? [] : riskItems(brief.profile)),
    ...cvItems(state),
    ...challengeItems(state),
    ...registryItems(state),
    ...signalItems(state),
  ];
  return {
    fit: traits.length === 0 ? null : fitPct(fit ?? { traits, fit_pct: 0 }),
    role: fit?.role ?? role,
    checked: {
      evidenced: traits.filter((t) => t.status === "has").length,
      partial: traits.filter((t) => t.status === "partial").length,
      none: traits.filter((t) => t.status === "none").length,
      total: traits.length,
    },
    pluses: items.filter((i) => i.side === "plus"),
    minuses: items.filter((i) => i.side === "minus"),
    notes: notes(brief),
  };
}

export const SCORECARD_NOTE =
  "The figure is the share of the role's must-haves with evidence, weighted as the role weights them; a line resting on the CV alone says so. It is not a prediction of performance and not a judgement of the person. Lines under “no effect on fit” are points for the interview, not deductions.";
