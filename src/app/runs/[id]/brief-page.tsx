/**
 * The finished brief for HR: header with role and hiring steps, 30-second numbers, "Before the interview", four tabs and a sticky kit sidebar.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/brief-page.tsx
 * Deps:    react, next/link, src/domain/run-cost, ../../ui, ./brief-layout, ./brief-tabs, ./brief-plan, ./brief-evidence,
 *          ./call-panel(-view), ./challenge, ./evidence, ./kit-actions, ./parts, ./profile-sections, ./report-lang, ./report-text,
 *          ./sections, ./summary, ./summary-card, ./state, ./code-profile-card, ./profile-signals-card, ./registry-checks-card, ./delete-card
 * Tested:  helpers in __tests__/brief-layout.test.ts; the page itself in the browser (1440 px and 390 px)
 *
 * Key responsibilities:
 * - BriefPage (status done with a brief): `id="brief"` root with the report `lang`; header (eyebrow "Candidate brief · role"
 *   linking the position, full name, headline, identity / phone / CACHED pills, EN | CZ switch, five hiring steps); a
 *   main column (degraded notice, In 30 seconds, Before the interview, tabs) and a 300 px sticky sidebar from lg (kit
 *   card, About this research + Audit record, delete, the "never scores people" note, All briefs); a fixed phone bar
 *   with copy + calendar below lg
 * - BriefView: the same main column without header and sidebar, for a brief on a run that is not done
 * - Tabs: Interview plan (default), Evidence (TopLine, criteria table / RoleCriteria, confirmed evidence, career
 *   timeline, ProfileSections, findings as compact rows or PerQuestion, code profile, registries), Phone screen
 *   (CallPanel), Sources and gaps (confirmed profiles, "How we confirmed it is X", gap groups, Also found, removed
 *   protected line, profile signals)
 * - The run's calls are read once here (useRunCalls) for the numbers, the plan's phone rows and the header pill, and
 *   reloaded when the phone panel finishes a call
 *
 * Design constraints:
 * - Describes the research and the process, never scores the candidate; phone answers are always "not public evidence"
 * - The phone panel and the kit sidebar stay English (lang="en"); everything else follows the report language
 */
"use client";

import Link from "next/link";
import { formatDuration } from "@/domain/run-cost";
import type { Brief } from "@/domain/claim";
import { intakeLine } from "@/app/intake/intake-rows";
import { CARD, CARD_SAGE, Chevron, Eyebrow, KEY, LINK, Pill, SUMMARY, SimulatedPill } from "../../ui";
import { type HiringStep, backgroundCounts, hiringSteps, latestAnswered, phoneNumbers, planItems, shortDay, tabCounts } from "./brief-layout";
import { CareerTimeline, ConfirmedProfiles, CriteriaTable, GapGroups } from "./brief-evidence";
import { BeforeInterview, PlanPanel } from "./brief-plan";
import { BriefNavContext, TabBar, TabPanel, useBriefNav } from "./brief-tabs";
import { CallPanel, useRunCalls } from "./call-panel-view";
import { CodeProfileCard } from "./code-profile-card";
import type { DeletionReceipt } from "@/domain/deletion";
import { DeleteCard } from "./delete-card";
import { evidenceOf } from "./evidence";
import { KitActions } from "./kit-actions";
import { AlsoFound, ConfirmedEvidence, DegradedNotice, PerQuestion, RoleCriteria, TopLine } from "./parts";
import { ProfileSections } from "./profile-sections";
import { ProfileSignalsCard } from "./profile-signals-card";
import { RegistryChecksCard } from "./registry-checks-card";
import { LangSwitch, ReportContext, useReport, useReportLanguage } from "./report-lang";
import { allUnavailable } from "./report-text";
import { SectionRows } from "./sections";
import { type RunState, briefSections, headerText, hiringFor } from "./state";
import { aiOff, criteriaCounts, criteriaRows } from "./summary";
import { SummaryCard } from "./summary-card";

const STEP_TONE: Record<HiringStep["state"], { rule: string; text: string }> = {
  done: { rule: "border-ok", text: "text-ok" },
  next: { rule: "border-ink", text: "text-ink" },
  todo: { rule: "border-divider", text: "text-muted" },
};

function Steps({ steps }: { steps: HiringStep[] }): React.JSX.Element {
  const { ui } = useReport().t;
  const detail = (s: HiringStep): string => {
    if (s.key === "identity") return ui.identityDetail(Number(s.detail));
    if (s.key === "phone") return s.state === "done" ? s.detail : ui.phoneNotYet;
    if (s.key === "interview") return s.state === "next" ? ui.interviewNext : ui.interviewLater;
    if (s.key === "decision") return ui.decisionByPerson;
    return s.detail;
  };
  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-5" aria-label={ui.stepsLabel}>
      {steps.map((s) => (
        <li key={s.key} className={`flex flex-col gap-1.5 border-t-2 pt-2 ${STEP_TONE[s.state].rule}`} aria-current={s.state === "next" ? "step" : undefined}>
          <span className={`font-semibold ${STEP_TONE[s.state].text}`}>
            {s.state === "done" && <span aria-hidden="true">✓ </span>}
            {ui.step[s.key]}
            {s.state === "done" && <span className="sr-only"> (done)</span>}
          </span>
          <span className="text-xs text-muted">{detail(s)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Everything the tabs and the numbers need, derived once per render. */
type Calls = ReturnType<typeof useRunCalls>;

function useBriefData(state: RunState, brief: Brief, calls: Calls) {
  const report = useReport();
  const call = calls.data === null ? null : latestAnswered(calls.data.calls);
  const answers = calls.data === null ? null : (call?.answers ?? null);
  const proposal = new Map((calls.data?.proposal.questions ?? []).map((q) => [q.question_id, q.text]));
  const evidence = evidenceOf(state);
  const plan = planItems(state, brief, evidence, answers, proposal);
  const counts = tabCounts(plan, backgroundCounts(state.claims, brief), phoneNumbers(answers));
  const crit = criteriaCounts(brief);
  const criteria = {
    total: crit.total,
    none: criteriaRows(brief).rows.filter((r) => r.coverage === "none").length,
    researchQuestions: crit.noun === "research questions",
    off: aiOff(brief),
  };
  return { report, call, answers, evidence, plan, counts, criteria };
}

/** Main column: degraded notice, In 30 seconds, Before the interview, tabs. `confirmation` = the "How we confirmed it" content. */
function BriefMain({ state, brief, calls, confirmation, first }: { state: RunState; brief: Brief; calls: Calls; confirmation: React.ReactNode; first: string }): React.JSX.Element {
  const { report, call, answers, evidence, plan, counts, criteria } = useBriefData(state, brief, calls);
  const { t } = report;
  const sections = briefSections(brief);
  const english = report.lang === "en" ? undefined : "en";
  const tabs = [
    { key: "plan", label: t.ui.tab.plan, count: counts.plan },
    { key: "evidence", label: t.ui.tab.evidence, count: counts.evidence },
    { key: "call", label: t.ui.tab.call, count: counts.call, open: counts.callOpen },
    { key: "sources", label: t.ui.tab.sources, count: counts.sources },
  ] as const;
  return (
    <div className="flex min-w-0 flex-col gap-8">
      {brief.degraded !== null && <DegradedNotice reason={brief.degraded} />}
      <SummaryCard state={state} answers={answers} callDay={call === null ? "" : shortDay(call.approved_at ?? call.created_at)} />
      <BeforeInterview plan={plan} claims={state.claims} brief={brief} evidence={evidence} devilsAdvocate={t.devilsAdvocate(state.challenge_summary)} criteria={criteria} />
      <div>
        <TabBar tabs={tabs} label={t.ui.tabsLabel} />
        <TabPanel k="plan">
          <PlanPanel plan={plan} role={hiringFor(state)} />
        </TabPanel>
        <TabPanel k="evidence">
          <TopLine headline={brief.headline ?? null} locationNote={brief.location_note ?? null} role={hiringFor(state)} />
          {allUnavailable(brief) ? <RoleCriteria questions={state.questions} /> : <CriteriaTable state={state} brief={brief} />}
          {brief.degraded !== null && <ConfirmedEvidence items={brief.evidence} />}
          {brief.profile && (
            <div lang={english} className="flex flex-col gap-6">
              <CareerTimeline history={brief.profile.history} evidence={evidence} nowIso={state.created_at} />
              <ProfileSections profile={brief.profile} evidence={evidence} role={hiringFor(state)} />
            </div>
          )}
          {sections !== null ? <SectionRows sections={sections} claims={state.claims} evidence={evidence} /> : !allUnavailable(brief) && <PerQuestion state={state} brief={brief} evidence={evidence} />}
          <CodeProfileCard profile={state.code_profile} />
          <RegistryChecksCard checks={state.registry_checks} />
        </TabPanel>
        <TabPanel k="call">
          <div lang={english}>
            <CallPanel state={state} onChanged={calls.reload} />
          </div>
        </TabPanel>
        <TabPanel k="sources">
          <ConfirmedProfiles candidates={state.candidates} />
          {confirmation !== null && (
            <details className="group border-t border-divider pt-4" lang={english}>
              <summary className={`${SUMMARY} text-base text-ink`}>
                <Chevron />
                {t.ui.howConfirmed(first)}
              </summary>
              <div className="mt-4 flex flex-col gap-8">{confirmation}</div>
            </details>
          )}
          <GapGroups brief={brief} />
          <AlsoFound items={brief.also_found} />
          {brief.removed_protected > 0 ? <p className="text-xs text-muted">{t.removedProtected(brief.removed_protected)}</p> : null}
          <ProfileSignalsCard signals={state.profile_signals} />
        </TabPanel>
      </div>
    </div>
  );
}

function AboutResearch({ state, id }: { state: RunState; id: string }): React.JSX.Element {
  const { cost } = state;
  const rows: [string, string][] = [
    ["Run", state.created_at.slice(0, 16).replace("T", " ") + " UTC"],
    ["Research time", formatDuration(cost.duration_ms)],
    ["Source calls", String(cost.source_calls)],
    ["AI calls", String(cost.llm_calls)],
    ["Cost", `$${cost.usd.toFixed(2)}`],
  ];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="about-h" lang="en">
      <h2 id="about-h" className={KEY}>About this research</h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <Link href={`/runs/${id}/audit`} className={`${LINK} w-fit text-sm`}>Audit record</Link>
    </section>
  );
}

export function BriefPage({
  state,
  brief,
  cached,
  confirmation,
  first,
  onDeleted,
}: {
  state: RunState;
  brief: Brief;
  cached: boolean;
  confirmation: React.ReactNode;
  first: string;
  onDeleted: (receipt: DeletionReceipt) => void;
}): React.JSX.Element {
  const language = useReportLanguage(state.id);
  const report = language.report;
  const nav = useBriefNav();
  return (
    <ReportContext value={report}>
      <BriefNavContext value={nav}>
        <BriefShell state={state} brief={brief} cached={cached} confirmation={confirmation} first={first} onDeleted={onDeleted} language={language} />
      </BriefNavContext>
    </ReportContext>
  );
}

function BriefShell({
  state,
  brief,
  cached,
  confirmation,
  first,
  onDeleted,
  language,
}: {
  state: RunState;
  brief: Brief;
  cached: boolean;
  confirmation: React.ReactNode;
  first: string;
  onDeleted: (receipt: DeletionReceipt) => void;
  language: ReturnType<typeof useReportLanguage>;
}): React.JSX.Element {
  const report = useReport();
  const { ui } = report.t;
  const calls = useRunCalls(state.id, true);
  const call = calls.data === null ? null : latestAnswered(calls.data.calls);
  const merged = state.candidates.filter((c) => c.decision === "merge").length;
  const role = hiringFor(state);
  const steps = hiringSteps(state, formatDuration(state.cost.duration_ms), call);
  return (
    <div id="brief" lang={report.lang === "en" ? undefined : report.lang} className="flex scroll-mt-6 flex-col gap-8">
      <header className="flex flex-col gap-6 border-b border-divider pb-8">
        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <Eyebrow>
              {ui.eyebrow}
              {role !== null && (
                <>
                  {" · "}
                  {state.position ? (
                    <Link href={`/positions/${encodeURIComponent(state.position.id)}`} className="underline decoration-action/40 underline-offset-4 hover:decoration-action">
                      {role}
                    </Link>
                  ) : (
                    role
                  )}
                </>
              )}
            </Eyebrow>
            <h1 className="font-serif text-4xl leading-[1.05] [overflow-wrap:anywhere] md:text-5xl">{state.subject.trim() === "" ? headerText(state.subject, true) : state.subject}</h1>
            {state.headline !== null && <p className="text-lg text-muted">{state.headline}</p>}
            {state.intake !== null && <p className="text-sm text-muted" lang="en">{intakeLine(state.intake)}</p>}
            <div className="flex flex-wrap gap-2">
              <Pill tone={merged > 0 ? "ok" : "neutral"}>{merged > 0 ? ui.identityPill(merged) : ui.noIdentity}</Pill>
              {call !== null && <Pill tone="ok">{ui.phonePill(shortDay(call.approved_at ?? call.created_at))}</Pill>}
              {cached && <SimulatedPill kind="cached" detail={`run from ${state.created_at.slice(0, 16).replace("T", " ")} UTC`} />}
            </div>
          </div>
          <div className="print:hidden sm:shrink-0">
            <LangSwitch runId={state.id} language={language} />
          </div>
        </div>
        <Steps steps={steps} />
      </header>
      <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
        <BriefMain state={state} brief={brief} calls={calls} confirmation={confirmation} first={first} />
        <aside className="flex flex-col gap-6 lg:sticky lg:top-6" lang="en" aria-label="Interview kit and research details">
          <KitActions state={state} language={language.exports} />
          <section className={`${CARD} flex flex-col gap-6`}>
            <AboutResearch state={state} id={state.id} />
          </section>
          <section className="rounded-2xl border border-conflict/40 px-5 pb-4 print:hidden">
            <DeleteCard runId={state.id} onDeleted={onDeleted} />
            <p className="text-xs text-muted">Do this when the candidate is rejected.</p>
          </section>
          <p className={`${CARD_SAGE} text-sm text-ink`}>Radar prepares evidence and never scores people. A person makes every decision.</p>
          <Link href="/briefs" className={`${LINK} w-fit text-sm print:hidden`}>All briefs</Link>
        </aside>
      </div>
      <KitActions state={state} language={language.exports} layout="bar" />
    </div>
  );
}

/** A brief on a run that is not done: the main column only (no header, no sidebar). */
export function BriefView({ state }: { state: RunState }): React.JSX.Element | null {
  const language = useReportLanguage(state.id);
  const nav = useBriefNav();
  const calls = useRunCalls(state.id, state.brief !== null);
  const brief = state.brief;
  if (brief === null) return null;
  return (
    <ReportContext value={language.report}>
      <BriefNavContext value={nav}>
        <div id="brief" lang={language.report.lang === "en" ? undefined : language.report.lang} className="flex scroll-mt-6 flex-col gap-6">
          <LangSwitch runId={state.id} language={language} />
          <BriefMain state={state} brief={brief} calls={calls} confirmation={null} first="" />
          <div lang="en">
            <KitActions state={state} language={language.exports} />
          </div>
        </div>
      </BriefNavContext>
    </ReportContext>
  );
}
