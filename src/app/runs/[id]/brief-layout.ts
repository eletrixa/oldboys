/**
 * Pure helpers for the finished brief layout: interview plan items, phone screen numbers, hiring steps, tab counts,
 * gap groups and the career timeline.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/brief-layout.ts
 * Deps:    src/domain/{call,claim} (types), ./call-panel (CallView, placedCalls), ./challenge (toVerifyItems), ./state (host, types)
 * Tested:  src/app/runs/[id]/__tests__/brief-layout.test.ts
 *
 * Key responsibilities:
 * - latestAnswered: the newest placed call whose answers were read (the one the plan and the 30-second card quote)
 * - planItems: ONE numbered interview plan from the existing lists: role criteria without full evidence (mh- ids), the
 *   "to verify" items (tv-<n> ids, the same ids the call proposal uses), then the brief's interview questions (no id, so no
 *   phone row); phone answers attach only by question_id, never by text similarity
 * - phoneNumbers: asked / answered / no answer of one call; hiringSteps: the five-step strip from existing state only
 * - gapGroups: searched-empty and not-searched gaps grouped by reason in plain words (the raw reason stays as a hint)
 * - historyDate / timelineRows: "Mon YYYY" or "YYYY" history dates on a year axis; open end = present
 *
 * Design constraints:
 * - No React, no fetch; describes the research and the process, never scores the candidate
 * - Phone answers are statements by the candidate; nothing here compares them with the research
 */
import type { CallAnswer } from "@/domain/call";
import type { Brief, Claim, Coverage, HistoryEntry } from "@/domain/claim";
import { type CallView, placedCalls } from "./call-panel";
import { toVerifyItems } from "./challenge";
import type { Evidence } from "./evidence";
import { tid } from "./report-text";
import { type RunState, host, searchedEmpty } from "./state";

/** The newest placed call whose answers were read; null when there is none. */
export function latestAnswered(calls: readonly CallView[]): CallView | null {
  return placedCalls(calls).find((c) => c.status === "done" && c.answers !== null && c.answers.length > 0) ?? null;
}

export type PlanGroup = "criteria" | "verify" | "suggested";

export type PlanItem = {
  /** 1-based number in the one list. */
  n: number;
  group: PlanGroup;
  /** Call question id when the item has one (mh-…, tv-…); null for the brief's interview questions. */
  id: string | null;
  /** Criterion title, or the claim kind of a to-verify item; null when unknown. */
  topic: string | null;
  topicKind: "criterion" | Claim["kind"] | null;
  coverage: Coverage | null;
  /** Host of the first source of a to-verify claim. */
  sourceHost: string | null;
  sourceUrl: string | null;
  /** Translation id of the text (tid); null for a call question, which has no translation. */
  textId: string | null;
  text: string;
  /** Devil's advocate reason of a challenged item; null otherwise. */
  note: string | null;
  /** undefined: no phone row (no id or no call yet); null: not asked on the call; else the answer. */
  answer: CallAnswer | null | undefined;
};

/** Criteria the plan asks about: role must-haves the research found no or only partial evidence for, none first. */
function openCriteria(brief: Brief): Brief["per_question"] {
  const mh = brief.per_question.filter((q) => q.question_id.startsWith("mh-") && q.coverage !== "evidenced");
  return [...mh.filter((q) => q.coverage === "none"), ...mh.filter((q) => q.coverage === "partial")];
}

/**
 * The interview plan. `answers` is the newest read call's answers (null = no call yet), `proposal` the call proposal's
 * question texts by id (a better spoken question than the bare criterion when present).
 */
export function planItems(
  state: Pick<RunState, "questions" | "claims" | "sources">,
  brief: Brief,
  evidence: Pick<Evidence, "challengeOf">,
  answers: readonly CallAnswer[] | null,
  proposal: ReadonlyMap<string, string> = new Map(),
): PlanItem[] {
  const byId = new Map(state.questions.map((q) => [q.id, q]));
  const answerOf = (id: string): CallAnswer | null | undefined => (answers === null ? undefined : (answers.find((a) => a.question_id === id) ?? null));
  const urlOf = new Map(state.sources.map((s) => [s.id, s.url]));
  const items: Omit<PlanItem, "n">[] = [];

  for (const p of openCriteria(brief)) {
    const q = byId.get(p.question_id);
    const answer = answerOf(p.question_id);
    const spoken = answer?.question ?? proposal.get(p.question_id);
    items.push({
      group: "criteria",
      id: p.question_id,
      topic: q?.title ?? q?.text ?? p.question_id,
      topicKind: "criterion",
      coverage: p.coverage,
      sourceHost: null,
      sourceUrl: null,
      textId: spoken === undefined ? tid.question(p.question_id) : null,
      text: spoken ?? q?.text ?? p.question_id,
      note: null,
      answer,
    });
  }

  toVerifyItems(brief, state.claims, evidence.challengeOf).forEach((item, i) => {
    const listed = i < brief.to_verify.length;
    const claim = state.claims.find((c) => c.text === item.text);
    const url = claim?.supports.map((sid) => urlOf.get(sid)).find((u) => u !== undefined) ?? null;
    const id = listed ? `tv-${String(i + 1)}` : null;
    items.push({
      group: "verify",
      id,
      topic: claim?.kind ?? null,
      topicKind: claim?.kind ?? null,
      coverage: null,
      sourceHost: url === null ? null : host(url),
      sourceUrl: url,
      textId: listed ? tid.toVerify(i) : claim === undefined ? null : tid.claim(claim.id),
      text: item.text,
      note: item.reason,
      answer: id === null ? undefined : answerOf(id),
    });
  });

  brief.interview_questions.forEach((text, i) => {
    items.push({ group: "suggested", id: null, topic: null, topicKind: null, coverage: null, sourceHost: null, sourceUrl: null, textId: tid.interviewQuestion(i), text, note: null, answer: undefined });
  });

  return items.map((item, i) => ({ ...item, n: i + 1 }));
}

/** Asked (status other than not_asked), answered, no answer; null without a read call. */
export function phoneNumbers(answers: readonly CallAnswer[] | null): { asked: number; answered: number; noAnswer: number; open: number } | null {
  if (answers === null) return null;
  const asked = answers.filter((a) => a.status !== "not_asked");
  return {
    asked: asked.length,
    answered: asked.filter((a) => a.status === "answered").length,
    noAnswer: asked.filter((a) => a.status === "no_answer").length,
    open: asked.filter((a) => a.status !== "answered").length,
  };
}

/** Facts and inferences the brief shows (call statements are not background). */
export function backgroundCounts(claims: readonly Claim[], brief: Brief): { facts: number; inferences: number; gaps: number } {
  const shown = new Set([...brief.sections.flatMap((s) => s.claim_ids), ...brief.per_question.flatMap((q) => q.claim_ids)]);
  const used = claims.filter((c) => shown.has(c.id));
  return {
    facts: used.filter((c) => c.kind === "FACT").length,
    inferences: used.filter((c) => c.kind === "INFERENCE").length,
    gaps: searchedEmpty(brief).length + brief.not_searched.length,
  };
}

export type StepState = "done" | "next" | "todo";
export type HiringStep = { key: "research" | "identity" | "phone" | "interview" | "decision"; state: StepState; detail: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "8 Oct" (UTC) from an ISO time; "" when it does not parse. */
export function shortDay(iso: string | null | undefined): string {
  const d = typeof iso === "string" ? new Date(iso) : null;
  return d === null || Number.isNaN(d.getTime()) ? "" : `${String(d.getUTCDate())} ${MONTHS[d.getUTCMonth()] ?? ""}`;
}

/**
 * Research, Identity, Phone screen, Interview, Decision. Only what the state proves is done; the interview is never marked
 * done (nothing stores it), the decision is always a person's.
 */
export function hiringSteps(state: Pick<RunState, "created_at" | "candidates">, durationText: string, call: CallView | null, day: (iso: string) => string = shortDay): HiringStep[] {
  const merged = state.candidates.filter((c) => c.decision === "merge").length;
  const phoneDone = call !== null;
  return [
    { key: "research", state: "done", detail: [day(state.created_at), durationText].filter((s) => s !== "").join(" · ") },
    { key: "identity", state: merged > 0 ? "done" : "todo", detail: String(merged) },
    { key: "phone", state: phoneDone ? "done" : "next", detail: phoneDone ? day(call.approved_at ?? call.created_at) : "" },
    { key: "interview", state: phoneDone ? "next" : "todo", detail: "" },
    { key: "decision", state: "todo", detail: "" },
  ];
}

export type GapGroup = "nothing-found" | "namesake" | "no-handle" | "busy" | "timeout" | "budget" | "login" | "other";

/** A gap's reason in one plain-words group; the order of GAP_GROUP_ORDER is the display order. */
export function gapGroup(reason: string, searched: boolean): GapGroup {
  const r = reason.toLowerCase();
  if (r.includes("none confirmed") || r.includes("same name")) return "namesake";
  if (r.includes("no confirmed handle") || r.includes("nothing to look up") || r.includes("no handle")) return "no-handle";
  if (/http (4\d\d|5\d\d)|rate limit|too many requests|throttle|forbidden|refused/.test(r)) return "busy";
  if (r.includes("timed-out") || r.includes("timed out") || r.includes("timeout")) return "timeout";
  if (r.includes("budget")) return "budget";
  if (r.includes("login")) return "login";
  if (searched) return "nothing-found";
  return "other";
}

export const GAP_GROUP_ORDER: readonly GapGroup[] = ["nothing-found", "namesake", "no-handle", "busy", "timeout", "budget", "login", "other"];

export type GapRow = { source: string; reason: string; index: number; searched: boolean };

/** Both gap lists, grouped in display order; empty groups dropped. */
export function gapGroups(brief: Brief): { group: GapGroup; rows: GapRow[] }[] {
  const rows = [
    ...searchedEmpty(brief).map((g, index) => ({ ...g, index, searched: true })),
    ...brief.not_searched.map((g, index) => ({ ...g, index, searched: false })),
  ];
  return GAP_GROUP_ORDER.map((group) => ({ group, rows: rows.filter((r) => gapGroup(r.reason, r.searched) === group) })).filter((g) => g.rows.length > 0);
}

const MONTH_INDEX = new Map(
  ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map((m, i) => [m, i]),
);

/** "Mar 2021", "March 2021", "2021" → fractional year (month start); null when it does not parse. */
export function historyDate(text: string | null): number | null {
  if (text === null) return null;
  const t = text.trim();
  const year = /^(\d{4})$/.exec(t);
  if (year !== null) return Number(year[1]);
  const my = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(t);
  if (my === null) return null;
  const m = MONTH_INDEX.get((my[1] ?? "").toLowerCase());
  return m === undefined ? null : Number(my[2]) + m / 12;
}

const PRESENT = /^(present|now|current|today|dosud|současnost)$/i;

export type TimelineRow = { entry: HistoryEntry; from: number; to: number; open: boolean };

/**
 * Entries with a parseable start and end (or an open end = `now`), newest start first, and the axis years; entries
 * without dates go to `undated`. Null when no entry has dates, so the caller keeps its list rendering.
 */
export function timelineRows(entries: readonly HistoryEntry[], nowYear: number): { rows: TimelineRow[]; undated: HistoryEntry[]; start: number; end: number } | null {
  const rows: TimelineRow[] = [];
  const undated: HistoryEntry[] = [];
  for (const entry of entries) {
    const from = historyDate(entry.from);
    const open = entry.to === null || PRESENT.test(entry.to.trim());
    const to = open ? nowYear : historyDate(entry.to);
    if (from === null || to === null || to < from) {
      undated.push(entry);
      continue;
    }
    // A bare year as the end covers that whole year.
    const end = !open && entry.to !== null && /^\d{4}$/.test(entry.to.trim()) ? to + 1 : to + 1 / 12;
    rows.push({ entry, from, to: Math.min(end, nowYear + 1 / 12), open });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.from - a.from);
  const start = Math.floor(Math.min(...rows.map((r) => r.from)));
  const end = Math.ceil(Math.max(...rows.map((r) => r.to)));
  return { rows, undated, start, end: Math.max(end, start + 1) };
}

/** Tab badges: plan items, shown claims, newest call's asked questions (unsure when any is open), gaps. */
export function tabCounts(plan: readonly PlanItem[], background: { facts: number; inferences: number; gaps: number }, phone: ReturnType<typeof phoneNumbers>): {
  plan: number;
  evidence: number;
  call: number;
  callOpen: boolean;
  sources: number;
} {
  return {
    plan: plan.length,
    evidence: background.facts + background.inferences,
    call: phone?.asked ?? 0,
    callOpen: phone !== null && phone.open > 0,
    sources: background.gaps,
  };
}
