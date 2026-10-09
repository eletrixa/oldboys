/**
 * Presentational pieces for the brief page: progress, profile lineup, question card, brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/parts.tsx
 * Deps:    react (client component, imported only by run-view.tsx), src/domain/claim (types), src/domain/run-cost, ../../ui (Radar vocabulary), ./sections, ./evidence, ./challenge, ./state, ./call-panel-view, ./report-lang, ./report-text, ./i18n (type)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - ProgressSteps, ProfileList, QuestionCard, BriefView, CostLine
 * - Pure rendering from props; all fetching and state lives in run-view.tsx
 * - Brief top line: "Confirmed profile: <headline>" next to "Hiring for: <position title or role>" (both quoted, no model needed),
 *   with the location note (confirmed profile names another city than the anchor) under the profile line
 * - Gap list reads "Searched, nothing confirmed" when any searched gap is a namesake-only one
 * - Confirmed evidence grouped by the URL's platform (evidenceGroup), not by the actor that fetched it; the pasted CV
 *   is plain text, not a link (SourceLink)
 * - "To verify" rows of challenged findings carry the devil's advocate reason (toVerifyItems, idea #8), followed by one
 *   muted line "Devil's advocate: checked N findings, M held, K moved to the interview" (challengeLine)
 * - Phone verification panel (CallPanel, client) right after "To verify"; it fetches its own data
 * - Interview kit exports (KitActions) after the gap lists, one block with AlsoFound and the removed line;
 *   gap rows split "Label: reason" into a medium label and muted reason; Check rows hang under a grid; gap labels come from state.ts (GAP_LABEL, gapText)
 * - Findings as sections by confidence (SectionList); briefs stored before sections render per question; both get the
 *   per-run evidence lookup (evidenceOf: sources with retrieval dates, saved text around quotes) for "Show evidence"
 * - Report language (idea #24): "EN | CZ" switch on top of the brief (LangSwitch); in Czech the brief area renders
 *   labels from the dictionary and the brief's own texts by id (tid), English per text when a translation is missing;
 *   the container gets lang="cs", quotes and excerpts keep their original language (lang=""), the call panel and the
 *   exports stay English (lang="en")
 * - Accessibility: labelled progressbar with status text, QuestionCard focuses its heading on mount, 44px summary and link targets
 *
 * Design constraints:
 * - No data fetching here (CallPanel and KitActions are self-contained client components); callbacks are passed in by the view
 * - Radar tokens only (docs/design/radar-ui.md): semantic colours via ../../ui, no raw palette classes
 */
"use client";

import { useEffect, useRef } from "react";
import type { Brief, Candidate, CandidateDecision } from "@/domain/claim";
import { formatDuration, type RunCost } from "@/domain/run-cost";
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, CARD, CARD_PEACH, CARD_UNSURE, Chevron, Pill, SimulatedPill, SUMMARY, SourceLink, type Tone } from "../../ui";
import { CallPanel } from "./call-panel-view";
import { toVerifyItems } from "./challenge";
import { originalLang } from "./claim-evidence";
import { KitActions } from "./kit-actions";
import { type Evidence as ClaimEvidence, evidenceOf } from "./evidence";
import type { Report } from "./i18n";
import { LangSwitch, ReportContext, useReport, useReportLanguage } from "./report-lang";
import { allUnavailable, tid } from "./report-text";
import { ClaimList, SectionList } from "./sections";
import { SummaryCard } from "./summary-card";
import { STEP_LABEL } from "./source-labels";
import { GAP_LABEL, PLATFORM_LABEL, type RowState, type RunState, briefSections, evidenceGroup, gapText, hiringFor, host, namesakeOnly, searchedEmpty } from "./state";

function Mark({ state }: { state: RowState }): React.JSX.Element {
  const base = "relative flex size-5 shrink-0 items-center justify-center rounded-full text-xs";
  if (state === "done") return <span className={`${base} bg-ok text-white`}><span aria-hidden="true">✓</span><span className="sr-only">Done</span></span>;
  if (state === "failed") return <span className={`${base} bg-conflict text-white`}><span aria-hidden="true">✕</span><span className="sr-only">Failed</span></span>;
  if (state === "active") return <span className={`${base} animate-pulse border-2 border-action bg-canvas`}><span className="sr-only">In progress</span></span>;
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
  stepIndex,
  stepCount,
}: {
  rows: RowState[];
  labels: string[];
  stepIndex: number;
  stepCount: number;
}): React.JSX.Element {
  const pct = percent(rows, stepIndex, stepCount);
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
        {labels.map((label, i) => (
          <li key={label} aria-current={i === activeIndex ? "step" : undefined} className={`flex items-center gap-3 text-sm ${rows[i] === "todo" || rows[i] === "skipped" ? "text-muted" : rows[i] === "failed" ? "text-conflict" : "text-ink"}`}>
            <Mark state={rows[i] ?? "todo"} />
            {label}
          </li>
        ))}
      </ol>
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
    </section>
  );
}

const COVERAGE = { evidenced: "ok", partial: "unsure", none: "neutral" } as const satisfies Record<string, Tone>;

/** A gap as a list item: "Label: reason" in the report language (reason by id), with the full raw reason on hover. */
const gapItem = (report: Report, id: string, g: Brief["not_searched"][number]): { text: string; hint: string } => ({
  text: `${report.t.label(GAP_LABEL[g.source] ?? g.source)}: ${report.text(id, gapText(g.reason))}`,
  hint: g.reason,
});

function List({
  title,
  items,
  numbered = false,
  check = false,
}: {
  title: string;
  items: (string | { text: string; hint?: string; note?: string | null })[];
  numbered?: boolean;
  check?: boolean;
}): React.JSX.Element | null {
  const { checkPill } = useReport().t;
  if (items.length === 0) return null;
  if (numbered) {
    return (
      <section>
        <h2 className="font-serif text-xl">{title}</h2>
        <ol className="mt-2 divide-y divide-divider">
          {items.map((t, i) => {
            const text = typeof t === "string" ? t : t.text;
            return (
              <li key={text} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3">
                <span className="font-serif text-xl text-action tabular-nums">{i + 1}</span>
                <span className="text-sm">{text}</span>
              </li>
            );
          })}
        </ol>
      </section>
    );
  }
  return (
    <section>
      <h2 className="font-serif text-xl">{title}</h2>
      <ul className="mt-2 divide-y divide-divider">
        {items.map((t) => {
          const text = typeof t === "string" ? t : t.text;
          if (check) {
            return (
              <li key={text} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 py-2 text-sm">
                <Pill tone="unsure" className="mt-0.5">{checkPill}</Pill>
                <span className="min-w-0">
                  {text}
                  {typeof t !== "string" && typeof t.note === "string" && <span className="mt-0.5 block text-xs text-muted">{t.note}</span>}
                </span>
              </li>
            );
          }
          const cut = text.indexOf(": ");
          return (
            <li key={text} title={typeof t === "string" ? undefined : t.hint} className="py-2 text-sm">
              {cut > 0 && cut < 40 ? (
                <>
                  <span className="font-medium text-ink">{text.slice(0, cut)}</span>
                  <span className="text-muted">{text.slice(cut)}</span>
                </>
              ) : (
                text
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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

function AlsoFound({ items }: { items: Evidence[] }): React.JSX.Element | null {
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

function DegradedNotice({ reason }: { reason: string }): React.JSX.Element {
  const { t, text } = useReport();
  return (
    <section className={`${CARD_UNSURE} flex flex-wrap items-center gap-2`}>
      <SimulatedPill kind="no-ai" />
      <p className="text-sm text-unsure">{t.degraded(text(tid.degraded, reason))}</p>
    </section>
  );
}

/** Who this is (quoted from a confirmed profile) next to what they are being screened for. */
function TopLine({ headline, locationNote, role }: { headline: string | null; locationNote: string | null; role: string | null }): React.JSX.Element | null {
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

function ConfirmedEvidence({ items }: { items: Evidence[] }): React.JSX.Element | null {
  const { t } = useReport();
  if (items.length === 0) return null;
  return (
    <section className={CARD}>
      <h2 className="font-serif text-xl">{t.fromConfirmed}</h2>
      <EvidenceList items={items} />
    </section>
  );
}


function RoleCriteria({ questions }: { questions: RunState["questions"] }): React.JSX.Element {
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

/** "To verify" rows in the report language: brief items by index, appended challenged claims by claim id, reasons translated. */
function toVerifyRows(state: RunState, brief: Brief, evidence: ClaimEvidence, report: Report): { text: string; note: string | null }[] {
  return toVerifyItems(brief, state.claims, evidence.challengeOf).map((item, i) => {
    const claim = state.claims.find((c) => c.text === item.text && evidence.challengeOf.has(c.id));
    const ch = claim === undefined ? undefined : evidence.challengeOf.get(claim.id);
    const text = i < brief.to_verify.length ? report.text(tid.toVerify(i), item.text) : report.text(tid.claim(claim?.id ?? ""), item.text);
    const note = ch === undefined || claim === undefined ? item.reason : report.t.challengeReason(ch.ground, report.text(tid.challenge(claim.id), ch.why));
    return { text, note };
  });
}

/** Per-question rows for briefs stored before sections. */
function PerQuestion({ state, brief, evidence }: { state: RunState; brief: Brief; evidence: ClaimEvidence }): React.JSX.Element {
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

function BriefBody({ state, brief }: { state: RunState; brief: Brief }): React.JSX.Element {
  const language = useReportLanguage(state.id);
  const report = language.report;
  const { t } = report;
  const evidence = evidenceOf(state);
  const sections = briefSections(brief);
  const devilsAdvocate = t.devilsAdvocate(state.challenge_summary);
  const empty = searchedEmpty(brief);
  const english = report.lang === "en" ? undefined : "en";
  return (
    <ReportContext value={report}>
      <div id="brief" lang={report.lang === "en" ? undefined : report.lang} className="flex scroll-mt-6 flex-col gap-4">
        <LangSwitch runId={state.id} language={language} />
        <SummaryCard state={state} />
        <TopLine headline={brief.headline ?? null} locationNote={brief.location_note ?? null} role={hiringFor(state)} />
        {brief.degraded !== null && <DegradedNotice reason={brief.degraded} />}
        {brief.degraded !== null && <ConfirmedEvidence items={brief.evidence} />}
        {sections !== null && <SectionList sections={sections} claims={state.claims} evidence={evidence} />}
        {allUnavailable(brief) ? <RoleCriteria questions={state.questions} /> : sections === null && <PerQuestion state={state} brief={brief} evidence={evidence} />}
        <List title={t.interviewQuestions} items={brief.interview_questions.map((q, i) => report.text(tid.interviewQuestion(i), q))} numbered />
        <List title={t.toVerify} items={toVerifyRows(state, brief, evidence, report)} check />
        {devilsAdvocate !== null && <p className="text-xs text-muted">{devilsAdvocate}</p>}
        <div lang={english}>
          <CallPanel state={state} />
        </div>
        <List title={t.searched(namesakeOnly(empty))} items={empty.map((g, i) => gapItem(report, tid.searchedEmpty(i), g))} />
        <List title={t.notSearched} items={brief.not_searched.map((g, i) => gapItem(report, tid.notSearched(i), g))} />
        <div className="flex flex-col gap-3">
          <div lang={english}>
            <KitActions state={state} />
          </div>
          <AlsoFound items={brief.also_found} />
          {brief.removed_protected > 0 ? <p className="text-xs text-muted">{t.removedProtected(brief.removed_protected)}</p> : null}
        </div>
      </div>
    </ReportContext>
  );
}

export function BriefView({ state }: { state: RunState }): React.JSX.Element | null {
  return state.brief === null ? null : <BriefBody state={state} brief={state.brief} />;
}
