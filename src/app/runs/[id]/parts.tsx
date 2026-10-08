/**
 * Presentational pieces for the brief page: progress, profile lineup, question card, brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/parts.tsx
 * Deps:    react (client component, imported only by run-view.tsx), src/domain/claim (types), src/domain/run-cost, ../../ui (Radar vocabulary), ./sections, ./state, ./call-panel-view
 * Tested:  n/a
 *
 * Key responsibilities:
 * - ProgressSteps, ProfileList, QuestionCard, BriefView, CostLine
 * - Pure rendering from props; all fetching and state lives in run-view.tsx
 * - Brief top line: "Confirmed profile: <headline>" next to "Hiring for: <role>" (both quoted, no model needed),
 *   with the location note (confirmed profile names another city than the anchor) under the profile line
 * - Gap list reads "Searched, nothing confirmed" when any searched gap is a namesake-only one
 * - Confirmed evidence grouped by the URL's platform (evidenceGroup), not by the actor that fetched it; the pasted CV
 *   is plain text, not a link (SourceLink)
 * - Phone verification panel (CallPanel, client) right after "To verify"; it fetches its own data
 * - Interview kit buttons (KitActions) under the top line; gap labels come from state.ts (GAP_LABEL, gapLine)
 * - Findings as sections by confidence (SectionList); briefs stored before sections render per question
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
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, CARD, CARD_PEACH, CARD_UNSURE, Pill, SourceLink, type Tone } from "../../ui";
import { CallPanel } from "./call-panel-view";
import { KitActions } from "./kit-actions";
import { ClaimList, SectionList } from "./sections";
import { SummaryCard } from "./summary-card";
import { PLATFORM_LABEL, type RowState, type RunState, briefSections, evidenceGroup, gapLine, host, roleCriteria, searchedEmpty, searchedTitle } from "./state";

function Mark({ state }: { state: RowState }): React.JSX.Element {
  const base = "relative flex size-5 shrink-0 items-center justify-center rounded-full text-xs";
  if (state === "done") return <span className={`${base} bg-ok text-white`}><span aria-hidden="true">✓</span><span className="sr-only">Done</span></span>;
  if (state === "failed") return <span className={`${base} bg-conflict text-white`}><span aria-hidden="true">✕</span><span className="sr-only">Failed</span></span>;
  if (state === "active") return <span className={`${base} animate-pulse border-2 border-action bg-canvas`}><span className="sr-only">In progress</span></span>;
  if (state === "skipped") return <span className={`${base} bg-divider text-muted`}><span aria-hidden="true">–</span><span className="sr-only">Skipped</span></span>;
  return <span className={`${base} border-2 border-divider bg-canvas`}><span className="sr-only">Waiting</span></span>;
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
    formatDuration(cost.duration_ms),
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
        <p className="truncate text-sm text-muted">{c.snippet}</p>
        {reason !== undefined && reason !== "" && <p className="truncate text-xs text-muted">{reason}</p>}
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
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted hover:text-ink">Show {String(extra.length)} more web hits</summary>
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

/** A gap as a list item: the plain line, with the full reason on hover. */
const gapItem = (g: Brief["not_searched"][number]): { text: string; hint: string } => ({ text: gapLine(g), hint: g.reason });

function List({
  title,
  items,
  numbered = false,
  check = false,
}: {
  title: string;
  items: (string | { text: string; hint: string })[];
  numbered?: boolean;
  check?: boolean;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  if (numbered) {
    return (
      <section>
        <h3 className="text-base font-semibold">{title}</h3>
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
      <h3 className="text-base font-semibold">{title}</h3>
      <ul className="mt-2 divide-y divide-divider">
        {items.map((t) =>
          typeof t === "string" ? (
            <li key={t} className="py-2 text-sm">
              {check && <Pill tone="unsure" className="mr-2">Check</Pill>}
              {t}
            </li>
          ) : (
            <li key={t.text} title={t.hint} className="py-2 text-sm">
              {t.text}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

type Evidence = Brief["evidence"][number];

/** Plain words for the actor id a source came from. */
const STEP_LABEL: Record<string, string> = {
  "apify/google-search-scraper": "Web search",
  "harvestapi/linkedin-profile-scraper": "LinkedIn",
  "apimaestro/linkedin-profile-detail": "LinkedIn",
  "harvestapi/linkedin-company": "LinkedIn company",
  "rest/github": "GitHub",
  "rest/stackexchange": "Stack Exchange",
  "rest/huggingface": "Hugging Face",
  "rest/orcid": "ORCID",
  "rest/openalex": "OpenAlex",
  "apidojo/tweet-scraper": "X",
  "apify/instagram-profile-scraper": "Instagram",
  "clockworks/tiktok-profile-scraper": "TikTok",
  "streamers/youtube-scraper": "YouTube",
  "rest/bluesky": "Bluesky",
  "apify/website-content-crawler": "Website",
  "ares/ekonomicke-subjekty/vyhledat": "ARES registry",
  "ares/ekonomicke-subjekty-vr": "ARES public register",
};

const EVIDENCE_VISIBLE = 10;

function EvidenceGroups({ items }: { items: Evidence[] }): React.JSX.Element {
  const byGroup = Map.groupBy(items, (e) => evidenceGroup(e, STEP_LABEL));
  return (
    <>
      {[...byGroup].map(([group, rows]) => (
        <div key={group} className="mt-4">
          <h3 className="text-sm font-semibold">{group}</h3>
          <ul className="mt-1 divide-y divide-divider">
            {rows.map((e) => (
              <li key={`${e.url}${e.excerpt}`} className="py-2 text-sm text-ink">
                {e.excerpt}
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
  const rest = items.slice(EVIDENCE_VISIBLE);
  return (
    <>
      <EvidenceGroups items={items.slice(0, EVIDENCE_VISIBLE)} />
      {rest.length > 0 && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted hover:text-ink">Show {String(rest.length)} more</summary>
          <EvidenceGroups items={rest} />
        </details>
      )}
    </>
  );
}

function AlsoFound({ items }: { items: Evidence[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-muted hover:text-ink">
        Mentions of the name, not confirmed ({String(items.length)}) — identity not verified, not used in the brief
      </summary>
      <EvidenceList items={items} />
    </details>
  );
}

function DegradedNotice({ reason }: { reason: string }): React.JSX.Element {
  return (
    <section className={CARD_UNSURE}>
      <p className="text-sm text-unsure">AI summary unavailable ({reason.replace(/\.$/, "")}). This brief lists only what we confirmed.</p>
    </section>
  );
}

/** Who this is (quoted from a confirmed profile) next to what they are being screened for. */
function TopLine({ headline, locationNote, role }: { headline: string | null; locationNote: string | null; role: string | null }): React.JSX.Element | null {
  if (headline === null && role === null) return null;
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {headline !== null && (
        <div>
          <dt className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Confirmed profile</dt>
          <dd className="mt-1 font-medium">{headline}</dd>
          {locationNote !== null && <dd className="mt-1 text-sm text-unsure">{locationNote}</dd>}
        </div>
      )}
      {role !== null && (
        <div>
          <dt className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Hiring for</dt>
          <dd className="mt-1 font-medium">{role}</dd>
        </div>
      )}
    </dl>
  );
}

function ConfirmedEvidence({ items }: { items: Evidence[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section className={CARD}>
      <h3 className="text-base font-semibold">From profiles you confirmed</h3>
      <EvidenceList items={items} />
    </section>
  );
}


function RoleCriteria({ texts }: { texts: string[] }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h3 className="text-base font-semibold">Role criteria (not checked, AI unavailable)</h3>
      {texts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No role criteria yet</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
          {texts.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BriefView({ state }: { state: RunState }): React.JSX.Element | null {
  const { brief } = state;
  if (!brief) return null;
  const urlOf = new Map(state.sources.map((s) => [s.id, s.url]));
  const noteOf = new Map(state.sources.flatMap((s) => (typeof s.identity_reason === "string" && s.identity_reason !== "" ? [[s.id, s.identity_reason] as const] : [])));
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  const allUnavailable = brief.per_question.length > 0 && brief.per_question.every((q) => q.summary.startsWith("AI summary unavailable"));
  const sections = briefSections(brief);
  return (
    <div id="brief" className="flex scroll-mt-6 flex-col gap-4">
      <SummaryCard state={state} />
      <TopLine headline={brief.headline ?? null} locationNote={brief.location_note ?? null} role={state.role} />
      <KitActions state={state} />
      {brief.degraded !== null && <DegradedNotice reason={brief.degraded} />}
      {brief.degraded !== null && <ConfirmedEvidence items={brief.evidence} />}
      {sections !== null && <SectionList sections={sections} claims={state.claims} urlOf={urlOf} noteOf={noteOf} />}
      {allUnavailable ? (
        <RoleCriteria texts={roleCriteria(state.questions)} />
      ) : (
        sections === null &&
        brief.per_question.map((q) => (
          <section key={q.question_id} className={CARD}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold">{textOf.get(q.question_id) ?? q.question_id}</h3>
              <Pill tone={COVERAGE[q.coverage]}>{q.coverage}</Pill>
            </div>
            <p className="mt-2 text-sm text-ink">{q.summary}</p>
            <ClaimList claims={state.claims.filter((c) => q.claim_ids.includes(c.id))} urlOf={urlOf} noteOf={noteOf} />
          </section>
        ))
      )}
      <List title="Interview questions" items={brief.interview_questions} numbered />
      <List title="To verify" items={brief.to_verify} check />
      <CallPanel state={state} />
      <List title={searchedTitle(searchedEmpty(brief))} items={searchedEmpty(brief).map(gapItem)} />
      <List title="Not searched, and why" items={brief.not_searched.map(gapItem)} />
      <AlsoFound items={brief.also_found} />
      {brief.removed_protected > 0 ? (
        <p className="text-xs text-muted">{String(brief.removed_protected)} {brief.removed_protected === 1 ? "item" : "items"} removed (protected categories)</p>
      ) : null}
    </div>
  );
}
