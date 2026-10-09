/**
 * "Before the interview" (only what needs action) and the Interview plan tab (one numbered list) of the finished brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/brief-plan.tsx
 * Deps:    react, src/domain/claim (types), ../../ui, ./brief-layout, ./brief-tabs, ./call-panel (ANSWER_BADGE, formatAt),
 *          ./claim-evidence (originalLang), ./kit-review-card, ./report-lang, ./summary, ./state
 * Tested:  item mapping in __tests__/brief-layout.test.ts
 *
 * Key responsibilities:
 * - BeforeInterview: to-verify items the phone screen answered (public source next to the phone answer, neutral "Compare"
 *   pill, never an automatic conflict), research-vs-research contradictions (claim.contradicts, "Sources disagree"), role
 *   criteria without public evidence ("a gap in the research, not a fact about the person"), inferences still to verify
 *   and the devil's advocate line; each links to its question in the plan
 * - PlanPanel: groups "Role criteria", "To verify", "Interview questions"; per item the topic pill, the why, the question,
 *   the phone row (status, summary, quote, "at m:ss", or "Not asked by phone") and a "Covered" checkbox with an
 *   "x of n covered" counter; then the filled-kit review (KitReviewCard)
 *
 * Design constraints:
 * - "Covered" lives in React state only: it is candidate data, and the delete path must remove everything
 * - Phone answers are statements by the candidate and always say they are not public evidence
 */
"use client";

import { useState } from "react";
import type { Brief, Claim } from "@/domain/claim";
import { CARD_FLUSH, FRAG, KEY, LINK, Pill, SourceLink, type Tone } from "../../ui";
import type { PlanItem } from "./brief-layout";
import { useNav } from "./brief-tabs";
import { ANSWER_BADGE, formatAt } from "./call-panel";
import { originalLang } from "./claim-evidence";
import type { Evidence } from "./evidence";
import { KitReviewCard } from "./kit-review-card";
import { useReport } from "./report-lang";
import { tid } from "./report-text";
import { shorten } from "./summary";

const itemText = (text: (id: string, english: string) => string, item: PlanItem): string => (item.textId === null ? item.text : text(item.textId, item.text));

function AskLink({ from, to }: { from: number; to: number }): React.JSX.Element {
  const { t } = useReport();
  const { goToItem } = useNav();
  return (
    <button type="button" className={`${LINK} w-fit text-sm`} onClick={() => { goToItem(from); }}>
      {t.ui.askQuestions(from, to)}
    </button>
  );
}

const ROW = "flex flex-col gap-3 p-5 md:p-6";

export function BeforeInterview({
  plan,
  claims,
  brief,
  evidence,
  devilsAdvocate,
  criteria,
}: {
  plan: readonly PlanItem[];
  claims: readonly Claim[];
  brief: Brief;
  evidence: Evidence;
  devilsAdvocate: string | null;
  criteria: { total: number; none: number; researchQuestions: boolean; off: boolean };
}): React.JSX.Element | null {
  const report = useReport();
  const { ui } = report.t;
  const lang = originalLang(report.lang);
  const compare = plan.filter((i) => i.group === "verify" && i.answer !== undefined && i.answer !== null && (i.answer.quote !== null || i.answer.summary !== null));
  const shown = new Set([...brief.sections.flatMap((s) => s.claim_ids), ...brief.per_question.flatMap((q) => q.claim_ids)]);
  const conflicts = claims.filter((c) => c.contradicts.length > 0 && shown.has(c.id));
  const criteriaItems = plan.filter((i) => i.group === "criteria");
  const compared = new Set(compare.map((i) => i.n));
  const inferences = plan.filter((i) => i.group === "verify" && i.topicKind === "INFERENCE" && !compared.has(i.n));
  const noEvidence = !criteria.off && !criteria.researchQuestions && criteria.none > 0;
  const n = compare.length + (conflicts.length > 0 ? 1 : 0) + (noEvidence ? 1 : 0) + (inferences.length > 0 ? 1 : 0) + (devilsAdvocate === null ? 0 : 1);
  if (n === 0) return null;
  const first = criteriaItems[0]?.n;
  const lastCriterion = criteriaItems.at(-1)?.n;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="before-h">
      <h2 id="before-h" className="font-serif text-2xl">
        {ui.before} <span className="text-muted tabular-nums">({n})</span>
      </h2>
      <ul className={`${CARD_FLUSH} divide-y divide-divider`}>
        {compare.map((item) => {
          const a = item.answer;
          if (a === undefined || a === null) return null;
          return (
            <li key={`cmp-${String(item.n)}`} className={ROW}>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="unsure">{ui.compare}</Pill>
                <span className={KEY}>{ui.topicVerify}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={FRAG}>
                  <p className={KEY}>{ui.publicSource}</p>
                  <p className="text-ink">{itemText(report.text, item)}</p>
                  {item.sourceUrl !== null && <SourceLink url={item.sourceUrl} className="w-fit text-xs" />}
                </div>
                <div className={FRAG} lang="en">
                  <p className={KEY}>{ui.phoneAt(a.at_secs === null ? null : formatAt(a.at_secs))}</p>
                  {a.quote !== null ? <q lang={lang} className="text-ink italic">{a.quote}</q> : <p className="text-ink">{a.summary}</p>}
                  <p className="text-xs text-muted">{ui.saidByCandidate}</p>
                </div>
              </div>
              <AskLink from={item.n} to={item.n} />
            </li>
          );
        })}
        {conflicts.length > 0 && (
          <li className={ROW}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="conflict">{ui.sourcesDisagree}</Pill>
              <h3 className="text-base font-semibold">{ui.contradictionsTitle(conflicts.length)}</h3>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {conflicts.map((c) => (
                <li key={c.id}>
                  {report.text(tid.claim(c.id), c.text)}
                  {c.supports.slice(0, 1).map((sid) => {
                    const url = evidence.sourceOf.get(sid)?.url;
                    return url === undefined ? null : <SourceLink key={sid} url={url} className="ml-2 text-xs" />;
                  })}
                </li>
              ))}
            </ul>
          </li>
        )}
        {noEvidence && (
          <li className={ROW}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="unsure">{ui.noEvidencePill}</Pill>
              <h3 className="text-base font-semibold">{ui.noEvidenceTitle(criteria.none, criteria.total)}</h3>
            </div>
            <p className="text-sm text-muted">{ui.gapNotPerson}</p>
            {first !== undefined && lastCriterion !== undefined && <AskLink from={first} to={lastCriterion} />}
          </li>
        )}
        {inferences.length > 0 && (
          <li className={ROW}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="inference">{ui.inferencesPill(inferences.length)}</Pill>
              <h3 className="text-base font-semibold">{ui.inferencesTitle}</h3>
            </div>
            <ul className="list-disc pl-5 text-sm text-ink">
              {inferences.map((i) => (
                <li key={i.n}>{shorten(itemText(report.text, i), 110)}</li>
              ))}
            </ul>
            <AskLink from={inferences[0]?.n ?? 1} to={inferences.at(-1)?.n ?? 1} />
          </li>
        )}
        {devilsAdvocate !== null && (
          <li className={`${ROW} sm:flex-row sm:items-center`}>
            <Pill tone="neutral">{ui.devilsAdvocatePill}</Pill>
            <p className="text-sm text-muted">{devilsAdvocate}</p>
          </li>
        )}
      </ul>
    </section>
  );
}

const TOPIC_TONE: Record<Claim["kind"], Tone> = { FACT: "neutral", INFERENCE: "inference", STATEMENT: "neutral" };

function PhoneRow({ item }: { item: PlanItem }): React.JSX.Element | null {
  const report = useReport();
  const { ui } = report.t;
  const a = item.answer;
  if (a === undefined) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-canvas px-3 py-2 text-sm" lang="en">
      <div className="flex flex-wrap items-center gap-2">
        <span className={KEY}>{ui.phone}</span>
        {a === null ? (
          <span className="text-muted">{ui.notAskedByPhone}</span>
        ) : (
          <>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ANSWER_BADGE[a.status].cls}`}>{ui.answerStatus[a.status]}</span>
            {a.summary !== null && <span className="min-w-0 text-ink">{a.summary}</span>}
          </>
        )}
      </div>
      {typeof a?.quote === "string" && (
        <p className="text-muted">
          <q lang={originalLang(report.lang)} className="italic">{a.quote}</q>
          {a.at_secs !== null && <span className="ml-2 text-xs tabular-nums">{ui.at(formatAt(a.at_secs))}</span>}
          <span className="ml-2 text-xs">{ui.saidByCandidate}</span>
        </p>
      )}
    </div>
  );
}

function PlanRow({ item, covered, onToggle }: { item: PlanItem; covered: boolean; onToggle: () => void }): React.JSX.Element {
  const report = useReport();
  const { t } = report;
  const { ui } = t;
  const why =
    item.coverage === "none" ? ui.whyNone : item.coverage === "partial" ? ui.whyPartial : item.sourceHost !== null ? ui.whyFrom(item.topicKind === "criterion" ? null : item.topicKind, item.sourceHost) : null;
  const topic =
    item.topicKind === "criterion" ? (
      <Pill tone="neutral">{item.topic}</Pill>
    ) : item.topicKind !== null ? (
      <Pill tone={TOPIC_TONE[item.topicKind]}>{t.kind[item.topicKind]}</Pill>
    ) : item.group === "verify" ? (
      <Pill tone="unsure">{ui.topicVerify}</Pill>
    ) : null;
  return (
    <li id={`plan-q-${String(item.n)}`} tabIndex={-1} className={`grid scroll-mt-20 grid-cols-[2rem_minmax(0,1fr)] gap-x-3 rounded-lg py-5 focus:outline-none ${covered ? "bg-ok-bg/40" : ""}`}>
      <span className="font-serif text-xl text-action tabular-nums">{item.n}</span>
      <div className="flex min-w-0 flex-col gap-2">
        {(topic !== null || why !== null) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {topic}
            {why !== null && <span className="text-xs text-muted">{why}</span>}
          </div>
        )}
        <p className="text-base text-ink [overflow-wrap:anywhere]">{itemText(report.text, item)}</p>
        {item.note !== null && <p className="text-xs text-muted">{item.note}</p>}
        <PhoneRow item={item} />
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-muted print:hidden">
          <input type="checkbox" className="size-4 accent-ok" checked={covered} onChange={onToggle} />
          {ui.covered}
        </label>
      </div>
    </li>
  );
}

const GROUP_ORDER = ["criteria", "verify", "suggested"] as const;

export function PlanPanel({ plan, role }: { plan: readonly PlanItem[]; role: string | null }): React.JSX.Element {
  const report = useReport();
  const { ui } = report.t;
  const [covered, setCovered] = useState<ReadonlySet<number>>(new Set());
  const toggle = (n: number) => (): void => {
    setCovered((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };
  const title = { criteria: ui.groupCriteria(role), verify: ui.groupVerify, suggested: ui.groupSuggested };
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-2xl">{ui.tab.plan}</h2>
          <p className="text-sm text-muted">
            {ui.planIntro}{" "}
            {plan.length > 0 && <span className="font-medium text-ink tabular-nums print:hidden" aria-live="polite">{ui.coveredCount(covered.size, plan.length)}</span>}
          </p>
        </div>
      </div>
      {plan.length === 0 && <p className="text-sm text-muted">{ui.emptyPlan}</p>}
      {GROUP_ORDER.map((g) => {
        const items = plan.filter((i) => i.group === g);
        if (items.length === 0) return null;
        return (
          <section key={g} aria-label={title[g]}>
            <p className={KEY}>{title[g]}</p>
            <ol className="mt-1 divide-y divide-divider">
              {items.map((item) => (
                <PlanRow key={item.n} item={item} covered={covered.has(item.n)} onToggle={toggle(item.n)} />
              ))}
            </ol>
          </section>
        );
      })}
      <div className="border-t border-divider pt-4">
        <KitReviewCard />
      </div>
    </>
  );
}
