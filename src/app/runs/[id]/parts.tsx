/**
 * Presentational pieces for the brief page: progress, profile lineup, question card, brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/parts.tsx
 * Deps:    react, src/domain/claim (types), src/domain/run-cost, ./sections, ./state
 * Tested:  n/a
 *
 * Key responsibilities:
 * - ProgressSteps, ProfileList, QuestionCard, BriefView, CostLine
 * - Pure rendering from props; all fetching and state lives in run-view.tsx
 * - Brief top line: "Confirmed profile: <headline>" next to "Hiring for: <role>" (both quoted, no model needed),
 *   with the location note (confirmed profile names another city than the anchor) under the profile line
 * - Gap list reads "Searched, nothing confirmed" when any searched gap is a namesake-only one
 * - Confirmed evidence grouped by the URL's platform (evidenceGroup), not by the actor that fetched it
 * - Interview kit buttons (KitActions) under the top line; gap labels come from state.ts (GAP_LABEL, gapLine)
 * - Findings as sections by confidence (SectionList); briefs stored before sections render per question
 *
 * Design constraints:
 * - No data fetching here; callbacks are passed in by the view
 */
import type { Brief, Candidate, CandidateDecision } from "@/domain/claim";
import { formatDuration, type RunCost } from "@/domain/run-cost";
import { KitActions } from "./kit-actions";
import { ClaimList, SectionList } from "./sections";
import { SummaryCard } from "./summary-card";
import { PLATFORM_LABEL, type RowState, type RunState, briefSections, evidenceGroup, gapLine, host, roleCriteria, searchedEmpty, searchedTitle } from "./state";

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5";

function Mark({ state }: { state: RowState }): React.JSX.Element {
  if (state === "done") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-teal-500 text-xs text-zinc-950">
        ✓
      </span>
    );
  }
  if (state === "failed") {
    return <span className="flex size-5 items-center justify-center rounded-full bg-red-500 text-xs text-zinc-950">✕</span>;
  }
  if (state === "active") {
    return <span className="size-5 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />;
  }
  if (state === "skipped") {
    return <span className="flex size-5 items-center justify-center rounded-full bg-zinc-700 text-xs text-zinc-300">–</span>;
  }
  return <span className="size-5 rounded-full border-2 border-zinc-700" />;
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
  return (
    <div className="flex flex-col gap-4">
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full transition-all ${failed ? "bg-red-500" : "bg-teal-500"}`} style={{ width: `${String(pct)}%` }} />
      </div>
      <ul className="flex flex-col gap-3">
        {labels.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 ${rows[i] === "todo" || rows[i] === "skipped" ? "text-zinc-500" : rows[i] === "failed" ? "text-red-300" : ""}`}>
            <Mark state={rows[i] ?? "todo"} />
            {label}
          </li>
        ))}
      </ul>
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
  return <p className="text-sm text-zinc-500">{parts.join(" · ")}</p>;
}

const BADGE: Record<CandidateDecision, { text: string; cls: string }> = {
  merge: { text: "This is them", cls: "bg-teal-500/15 text-teal-300" },
  rejected: { text: "Someone else", cls: "bg-zinc-800 text-zinc-400" },
  "possibly-same-as": { text: "Not sure yet", cls: "bg-amber-500/15 text-amber-300" },
};

const MARK: Record<string, string> = { linkedin: "in", x: "X", github: "gh", instagram: "ig", tiktok: "tt", youtube: "yt", bluesky: "bs", facebook: "fb" };

/** Two-letter platform badge; plain web hits get their hostname initial. */
function PlatformMark({ c }: { c: Pick<Candidate, "platform" | "profile_urls"> }): React.JSX.Element {
  const text = MARK[c.platform] ?? host(c.profile_urls[0] ?? "web").charAt(0);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-xs font-semibold text-teal-300">
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
    <li className="flex items-center gap-3">
      <PlatformMark c={c} />
      <div className="min-w-0 flex-1">
        <a href={c.profile_urls[0]} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
          {platformLabel(c)}
        </a>
        <p className="truncate text-sm text-zinc-400">{c.snippet}</p>
        {reason !== undefined && reason !== "" && <p className="truncate text-xs text-zinc-500">{reason}</p>}
      </div>
      <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${badge.cls}`}>{badge.text}</span>
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
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">Profiles we found</h2>
      <ul className="flex flex-col gap-3">
        {[...profiles, ...web.slice(0, WEB_VISIBLE)].map((c) => (
          <ProfileRow key={c.id} c={c} decision={decisionOf(c)} />
        ))}
      </ul>
      {extra.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200">Show {String(extra.length)} more web hits</summary>
          <ul className="mt-3 flex flex-col gap-3">
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
  const btn = "rounded-xl border border-amber-700/60 px-4 py-2 text-sm hover:bg-amber-500/10";
  const label = platformLabel(candidate);
  const who = candidate.handle !== null && candidate.platform !== "web" ? `${label} · @${candidate.handle}` : label;
  return (
    <section className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-5" aria-live="polite">
      <h2 className="font-semibold text-amber-200">Quick question: is this {label} profile also {first}?</h2>
      <div className="mt-3 flex items-start gap-3">
        <PlatformMark c={candidate} />
        <div className="min-w-0">
          <a href={candidate.profile_urls[0]} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
            {who}
          </a>
          <p className="text-sm text-zinc-400">{candidate.snippet}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={`${btn} bg-amber-500 text-zinc-950 hover:bg-amber-400`} onClick={() => { onAnswer(candidate.id, "merge"); }}>
          Yes, it&apos;s them
        </button>
        <button type="button" className={btn} onClick={() => { onAnswer(candidate.id, "rejected"); }}>
          No
        </button>
        <button type="button" className={btn} onClick={() => { onAnswer(candidate.id, "possibly-same-as"); }}>
          I&apos;m not sure
        </button>
      </div>
    </section>
  );
}

const COVERAGE = {
  evidenced: "bg-teal-500/15 text-teal-300",
  partial: "bg-amber-500/15 text-amber-300",
  none: "bg-zinc-800 text-zinc-400",
} as const;

/** A gap as a list item: the plain line, with the full reason on hover. */
const gapItem = (g: Brief["not_searched"][number]): { text: string; hint: string } => ({ text: gapLine(g), hint: g.reason });

function List({ title, items }: { title: string; items: (string | { text: string; hint: string })[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section className={CARD}>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
        {items.map((t) =>
          typeof t === "string" ? (
            <li key={t}>{t}</li>
          ) : (
            <li key={t.text} title={t.hint}>
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
          <ul className="mt-2 flex flex-col gap-2">
            {rows.map((e) => (
              <li key={`${e.url}${e.excerpt}`} className="text-sm text-zinc-300">
                {e.excerpt}
                <a href={e.url} target="_blank" rel="noreferrer" className="ml-2 text-teal-400 underline">
                  {host(e.url)}
                </a>
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
          <summary className="cursor-pointer text-sm text-zinc-400 hover:text-zinc-200">Show {String(rest.length)} more</summary>
          <EvidenceGroups items={rest} />
        </details>
      )}
    </>
  );
}

function AlsoFound({ items }: { items: Evidence[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <details className={CARD}>
      <summary className="cursor-pointer text-sm font-semibold">
        Mentions of the name, not confirmed ({String(items.length)}) — identity not verified, not used in the brief
      </summary>
      <EvidenceList items={items} />
    </details>
  );
}

function DegradedNotice({ reason }: { reason: string }): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-5">
      <p className="text-sm text-amber-200">AI summary unavailable ({reason.replace(/\.$/, "")}). This brief lists only what we confirmed.</p>
    </section>
  );
}

/** Who this is (quoted from a confirmed profile) next to what they are being screened for. */
function TopLine({ headline, locationNote, role }: { headline: string | null; locationNote: string | null; role: string | null }): React.JSX.Element | null {
  if (headline === null && role === null) return null;
  return (
    <section className={CARD}>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {headline !== null && (
          <div>
            <dt className="text-zinc-500">Confirmed profile</dt>
            <dd className="font-medium">{headline}</dd>
            {locationNote !== null && <dd className="mt-1 text-amber-300">{locationNote}</dd>}
          </div>
        )}
        {role !== null && (
          <div>
            <dt className="text-zinc-500">Hiring for</dt>
            <dd className="font-medium">{role}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function ConfirmedEvidence({ items }: { items: Evidence[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section className={CARD}>
      <h2 className="font-semibold">From profiles you confirmed</h2>
      <EvidenceList items={items} />
    </section>
  );
}


function RoleCriteria({ texts }: { texts: string[] }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h3 className="font-semibold">Role criteria (not checked, AI unavailable)</h3>
      {texts.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">No role criteria yet</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
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
              <h3 className="font-semibold">{textOf.get(q.question_id) ?? q.question_id}</h3>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${COVERAGE[q.coverage]}`}>{q.coverage}</span>
            </div>
            <p className="mt-2 text-sm text-zinc-300">{q.summary}</p>
            <ClaimList claims={state.claims.filter((c) => q.claim_ids.includes(c.id))} urlOf={urlOf} noteOf={noteOf} />
          </section>
        ))
      )}
      <List title="Interview questions" items={brief.interview_questions} />
      <List title="To verify" items={brief.to_verify} />
      <List title={searchedTitle(searchedEmpty(brief))} items={searchedEmpty(brief).map(gapItem)} />
      <List title="Not searched, and why" items={brief.not_searched.map(gapItem)} />
      <AlsoFound items={brief.also_found} />
      {brief.removed_protected > 0 ? (
        <p className="text-xs text-zinc-500">{String(brief.removed_protected)} items removed (protected categories)</p>
      ) : null}
    </div>
  );
}
