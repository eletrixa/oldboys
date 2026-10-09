/**
 * Presentational pieces for the brief page: progress, profile lineup, question card, brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/parts.tsx
 * Deps:    react (client component, imported by run-view.tsx, brief-page.tsx, brief-evidence.tsx), src/domain/claim (types), src/domain/run-cost, ../../ui (Radar vocabulary), ./sections, ./evidence, ./claim-evidence, ./state, ./source-labels, ./report-lang, ./report-text
 * Tested:  n/a
 *
 * Key responsibilities:
 * - ProgressSteps (bar from the time-weighted share when given, five rows with a right-hand detail each, a foot slot),
 *   ProfileList, QuestionCard, CostLine (running and lineup views, and the "How we confirmed it" disclosure)
 * - Brief pieces the finished brief (brief-page.tsx) places in its tabs: TopLine ("Confirmed profile" next to "Hiring
 *   for", location note), DegradedNotice, ConfirmedEvidence (grouped by the URL's platform), RoleCriteria (AI off),
 *   PerQuestion (briefs stored before sections), AlsoFound (namesakes, never claimed); platformLabel
 * - Pure rendering from props and the report context; all fetching and state lives in run-view.tsx / brief-page.tsx
 * - Report language (idea #24): labels from the dictionary, the brief's own texts by id (tid), quotes keep their
 *   original language (lang="")
 * - Accessibility: labelled progressbar with status text, QuestionCard focuses its heading on mount, 44px summary and link targets
 *
 * Design constraints:
 * - No data fetching here; callbacks are passed in by the view
 * - Radar tokens only (docs/design/radar-ui.md): semantic colours via ../../ui, no raw palette classes
 */
"use client";

import { useEffect, useRef } from "react";
import type { Brief, Candidate, CandidateDecision } from "@/domain/claim";
import { formatDuration, type RunCost } from "@/domain/run-cost";
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, CARD, CARD_PEACH, CARD_UNSURE, Chevron, Pill, SimulatedPill, SUMMARY, SourceLink, type Tone } from "../../ui";
import { originalLang } from "./claim-evidence";
import type { Evidence as ClaimEvidence } from "./evidence";
import { useReport } from "./report-lang";
import { tid } from "./report-text";
import { ClaimList } from "./sections";
import { STEP_LABEL } from "./source-labels";
import { PLATFORM_LABEL, type RowState, type RunState, evidenceGroup, host } from "./state";

function Mark({ state }: { state: RowState }): React.JSX.Element {
  const base = "relative flex size-5 shrink-0 items-center justify-center rounded-full text-xs";
  if (state === "done") return <span className={`${base} bg-ok text-white`}><span aria-hidden="true">✓</span><span className="sr-only">Done</span></span>;
  if (state === "failed") return <span className={`${base} bg-conflict text-white`}><span aria-hidden="true">✕</span><span className="sr-only">Failed</span></span>;
  if (state === "active") return <span className={`${base} motion-safe:animate-pulse border-2 border-action bg-canvas`}><span className="sr-only">In progress</span></span>;
  if (state === "skipped") return <span className={`${base} bg-divider text-muted`}><span aria-hidden="true">–</span><span className="sr-only">Skipped</span></span>;
  return <span className={`${base} border-2 border-line/60 bg-canvas`}><span className="sr-only">Waiting</span></span>;
}

/** Percent of the recipe already in the ledger; never fully empty so the bar reads as alive. */
function percent(rows: RowState[], stepIndex: number, stepCount: number): number {
  if (rows.every((r) => r === "done" || r === "skipped")) return 100;
  if (stepCount === 0) return rows.filter((r) => r === "done").length * 20;
  return Math.max(4, Math.min(95, Math.round((stepIndex / stepCount) * 100)));
}

export function ProgressSteps({
  rows,
  labels,
  details = [],
  share = null,
  stepIndex,
  stepCount,
  foot = null,
}: {
  rows: RowState[];
  labels: string[];
  /** Right-hand note per row: "48 s" for a finished phase, what is still read for the active one, the typical time for the rest. */
  details?: (string | null)[];
  /** Time-weighted share 0..1 (plans/015); null falls back to the step index. */
  share?: number | null;
  stepIndex: number;
  stepCount: number;
  foot?: React.ReactNode;
}): React.JSX.Element {
  const pct = share === null ? percent(rows, stepIndex, stepCount) : rows.includes("failed") ? Math.round(share * 100) : Math.max(4, Math.min(99, Math.round(share * 100)));
  const failed = rows.includes("failed");
  const activeIndex = rows.indexOf("active");
  const activeLabel = activeIndex >= 0 ? labels[activeIndex] : undefined;
  const valueText = failed ? "Failed" : pct === 100 ? "Done" : (activeLabel ?? "Working");
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {activeLabel ?? (failed ? "Research failed" : "Research finished")}
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-divider"
        role="progressbar"
        aria-label="Research progress"
        aria-valuetext={valueText}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full transition-[width] duration-700 ${failed ? "bg-conflict" : pct === 100 ? "bg-ok" : "bg-action"}`} style={{ width: `${String(pct)}%` }} />
      </div>
      <ol className="relative flex flex-col gap-3">
        <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 left-[9.5px] w-px bg-divider" />
        {labels.map((label, i) => {
          const detail = details[i] ?? null;
          return (
            <li key={label} aria-current={i === activeIndex ? "step" : undefined} className={`flex items-start gap-3 text-sm ${rows[i] === "todo" || rows[i] === "skipped" ? "text-muted" : rows[i] === "failed" ? "text-conflict" : "text-ink"}`}>
              <Mark state={rows[i] ?? "todo"} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span>{label}</span>
                {detail !== null && <span className="text-xs text-muted tabular-nums sm:text-right">{detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {foot}
    </div>
  );
}

/** One muted line: what the research cost so far and how long it took (pauses excluded). */
export function CostLine({ cost }: { cost: RunCost }): React.JSX.Element {
  const parts = [
    `Research cost $${cost.usd.toFixed(2)}`,
    `${String(cost.source_calls)} source ${cost.source_calls === 1 ? "call" : "calls"}`,
    `${String(cost.llm_calls)} AI ${cost.llm_calls === 1 ? "call" : "calls"}`,
    // Non-breaking spaces keep "3 min 34 s" on one line at phone width.
    formatDuration(cost.duration_ms).replace(/ /g, "\u00a0"),
  ];
  return <p className="text-sm text-muted tabular-nums">{parts.join(" · ")}</p>;
}

const BADGE: Record<CandidateDecision, { text: string; tone: Tone }> = {
  merge: { text: "This is them", tone: "ok" },
  rejected: { text: "Someone else", tone: "neutral" },
  "possibly-same-as": { text: "Not sure yet", tone: "unsure" },
};

const MARK: Record<string, string> = { linkedin: "in", x: "X", github: "gh", instagram: "ig", tiktok: "tt", youtube: "yt", bluesky: "bs", facebook: "fb" };

/** Two-letter platform badge; plain web hits get their hostname initial. */
function PlatformMark({ c }: { c: Pick<Candidate, "platform" | "profile_urls"> }): React.JSX.Element {
  const text = MARK[c.platform] ?? host(c.profile_urls[0] ?? "web").charAt(0);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-semibold text-ink">
      {text}
    </span>
  );
}

/** "LinkedIn", or the site's hostname for plain web hits. */
export function platformLabel(c: Pick<Candidate, "platform" | "profile_urls">): string {
  return PLATFORM_LABEL[c.platform] ?? host(c.profile_urls[0] ?? "web");
}

const WEB_VISIBLE = 5;

function ProfileRow({ c, decision }: { c: Candidate; decision: CandidateDecision }): React.JSX.Element {
  const badge = BADGE[decision];
  const reason = c.reasons[0]?.replace(/^fallback:\s*/i, "");
  return (
    <li className="flex items-center gap-3 py-3">
      <PlatformMark c={c} />
      <div className="min-w-0 flex-1">
        <a href={c.profile_urls[0]} target="_blank" rel="noreferrer" className="flex min-h-11 items-center text-sm font-medium hover:underline">
          {platformLabel(c)}
        </a>
        <p className="line-clamp-2 text-sm text-muted">{c.snippet}</p>
        {reason !== undefined && reason !== "" && <p className="text-xs text-muted">{reason}</p>}
      </div>
      <Pill tone={badge.tone}>{badge.text}</Pill>
    </li>
  );
}

export function ProfileList({
  candidates,
  decisionOf,
}: {
  candidates: Candidate[];
  decisionOf: (c: Candidate) => CandidateDecision;
}): React.JSX.Element {
  const profiles = candidates.filter((c) => c.platform !== "web");
  const web = candidates.filter((c) => c.platform === "web");
  const extra = web.slice(WEB_VISIBLE);
  return (
    <section>
      <h2 className="text-base font-semibold">Profiles we found</h2>
      <ul className="mt-2 divide-y divide-divider">
        {[...profiles, ...web.slice(0, WEB_VISIBLE)].map((c) => (
          <ProfileRow key={c.id} c={c} decision={decisionOf(c)} />
        ))}
      </ul>
      {extra.length > 0 && (
        <details className="group mt-3">
          <summary className={SUMMARY}><Chevron />Show {String(extra.length)} more web hits</summary>
          <ul className="mt-2 divide-y divide-divider">
            {extra.map((c) => (
              <ProfileRow key={c.id} c={c} decision={decisionOf(c)} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export type Answer = CandidateDecision;

export function QuestionCard({
  candidate,
  first,
  onAnswer,
}: {
  candidate: Candidate;
  first: string;
  onAnswer: (id: string, answer: Answer) => void;
}): React.JSX.Element {
  const label = platformLabel(candidate);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const who = candidate.handle !== null && candidate.platform !== "web" ? `${label} · @${candidate.handle}` : label;
  return (
    <section className={CARD_PEACH}>
      <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl focus:outline-none">Quick question: is this {label} profile also {first}?</h2>
      <p className="mt-1 text-sm text-muted">Your answer decides whether we use this profile in the brief.</p>
      <div className="mt-3 flex items-start gap-3">
        <PlatformMark c={candidate} />
        <div className="min-w-0">
          <a href={candidate.profile_urls[0]} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
            {who}
          </a>
          <p className="text-sm text-muted">{candidate.snippet}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={() => { onAnswer(candidate.id, "merge"); }}>
          Yes, it&apos;s them
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={() => { onAnswer(candidate.id, "rejected"); }}>
          No
        </button>
        <button type="button" className={BTN_QUIET} onClick={() => { onAnswer(candidate.id, "possibly-same-as"); }}>
          I&apos;m not sure
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">Not sure? We keep it as &quot;possibly the same person&quot; and never quote it as a fact.</p>
    </section>
  );
}

const COVERAGE = { evidenced: "ok", partial: "unsure", none: "neutral" } as const satisfies Record<string, Tone>;

type Evidence = Brief["evidence"][number];

const EVIDENCE_VISIBLE = 10;

function EvidenceGroups({ items }: { items: Evidence[] }): React.JSX.Element {
  const { t, lang } = useReport();
  const byGroup = Map.groupBy(items, (e) => evidenceGroup(e, STEP_LABEL));
  return (
    <>
      {[...byGroup].map(([group, rows]) => (
        <div key={group} className="mt-4">
          <h3 className="text-sm font-semibold">{t.label(group)}</h3>
          <ul className="mt-1 divide-y divide-divider">
            {rows.map((e) => (
              <li key={`${e.url}${e.excerpt}`} className="py-2 text-sm text-ink">
                <span lang={originalLang(lang)}>{e.excerpt}</span>
                <SourceLink url={e.url} className="ml-2" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** First 10 rows, the rest behind "Show N more". */
function EvidenceList({ items }: { items: Evidence[] }): React.JSX.Element {
  const { t } = useReport();
  const rest = items.slice(EVIDENCE_VISIBLE);
  return (
    <>
      <EvidenceGroups items={items.slice(0, EVIDENCE_VISIBLE)} />
      {rest.length > 0 && (
        <details className="group mt-3">
          <summary className={SUMMARY}><Chevron />{t.showMore(rest.length)}</summary>
          <EvidenceGroups items={rest} />
        </details>
      )}
    </>
  );
}

export function AlsoFound({ items }: { items: Evidence[] }): React.JSX.Element | null {
  const { t } = useReport();
  if (items.length === 0) return null;
  return (
    <details className="group">
      <summary className={SUMMARY}>
        <Chevron />
        {t.alsoFound(items.length)}
      </summary>
      <p className="text-xs text-muted">{t.notUsed}</p>
      <EvidenceList items={items} />
    </details>
  );
}

export function DegradedNotice({ reason }: { reason: string }): React.JSX.Element {
  const { t, text } = useReport();
  return (
    <section className={`${CARD_UNSURE} flex flex-wrap items-center gap-2`}>
      <SimulatedPill kind="no-ai" />
      <p className="text-sm text-unsure">{t.degraded(text(tid.degraded, reason))}</p>
    </section>
  );
}

/** Who this is (quoted from a confirmed profile) next to what they are being screened for. */
export function TopLine({ headline, locationNote, role }: { headline: string | null; locationNote: string | null; role: string | null }): React.JSX.Element | null {
  const { t, text, lang } = useReport();
  if (headline === null && role === null) return null;
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {headline !== null && (
        <div>
          <dt className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{t.confirmedProfile}</dt>
          <dd lang={originalLang(lang)} className="mt-1 font-medium">{headline}</dd>
          {locationNote !== null && <dd className="mt-1 text-sm text-unsure">{text(tid.locationNote, locationNote)}</dd>}
        </div>
      )}
      {role !== null && (
        <div>
          <dt className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{t.hiringFor}</dt>
          <dd lang={originalLang(lang)} className="mt-1 font-medium">{role}</dd>
        </div>
      )}
    </dl>
  );
}

export function ConfirmedEvidence({ items }: { items: Evidence[] }): React.JSX.Element | null {
  const { t } = useReport();
  if (items.length === 0) return null;
  return (
    <section className={CARD}>
      <h2 className="font-serif text-xl">{t.fromConfirmed}</h2>
      <EvidenceList items={items} />
    </section>
  );
}


export function RoleCriteria({ questions }: { questions: RunState["questions"] }): React.JSX.Element {
  const { t, text } = useReport();
  const criteria = questions.filter((q) => q.id.startsWith("mh-"));
  return (
    <section className={CARD}>
      <h2 className="font-serif text-xl">{t.roleCriteriaOff}</h2>
      {criteria.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t.noRoleCriteria}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
          {criteria.map((q) => (
            <li key={q.id}>{text(tid.question(q.id), q.text)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Per-question rows for briefs stored before sections. */
export function PerQuestion({ state, brief, evidence }: { state: RunState; brief: Brief; evidence: ClaimEvidence }): React.JSX.Element {
  const { t, text } = useReport();
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  return (
    <>
      {brief.per_question.map((q) => (
        <section key={q.question_id} className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold">{text(tid.question(q.question_id), textOf.get(q.question_id) ?? q.question_id)}</h3>
            <Pill tone={COVERAGE[q.coverage]}>{t.coverage[q.coverage]}</Pill>
          </div>
          <p className="mt-2 text-sm text-ink">{text(tid.questionSummary(q.question_id), q.summary)}</p>
          <ClaimList claims={state.claims.filter((c) => q.claim_ids.includes(c.id))} evidence={evidence} />
        </section>
      ))}
    </>
  );
}
