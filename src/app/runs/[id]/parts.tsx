/**
 * Presentational pieces for the brief page: progress, profile lineup, question card, brief.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/parts.tsx
 * Deps:    react, src/domain/claim (types), src/domain/run-cost
 * Tested:  n/a
 *
 * Key responsibilities:
 * - ProgressSteps, ProfileList, QuestionCard, BriefView, CostLine
 * - Pure rendering from props; all fetching and state lives in run-view.tsx
 *
 * Design constraints:
 * - No data fetching here; callbacks are passed in by the view
 */
import type { Brief, Candidate, CandidateDecision } from "@/domain/claim";
import { formatDuration, type RunCost } from "@/domain/run-cost";
import type { RowState, RunState } from "./state";

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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
  return <span className="size-5 rounded-full border-2 border-zinc-700" />;
}

/** Percent of the recipe already in the ledger; never fully empty so the bar reads as alive. */
function percent(rows: RowState[], stepIndex: number, stepCount: number): number {
  if (rows.every((r) => r === "done")) return 100;
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
          <li key={label} className={`flex items-center gap-3 ${rows[i] === "todo" ? "text-zinc-500" : rows[i] === "failed" ? "text-red-300" : ""}`}>
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

const MARK: Record<string, string> = { linkedin: "in", x: "X", github: "gh", instagram: "ig", tiktok: "tt", youtube: "yt", bluesky: "bs" };

/** Two-letter platform badge; plain web hits get their hostname initial. */
function PlatformMark({ c }: { c: Pick<Candidate, "platform" | "profile_urls"> }): React.JSX.Element {
  const text = MARK[c.platform] ?? host(c.profile_urls[0] ?? "web").charAt(0);
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-xs font-semibold text-teal-300">
      {text}
    </span>
  );
}

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
};

/** "LinkedIn", or the site's hostname for plain web hits. */
export function platformLabel(c: Pick<Candidate, "platform" | "profile_urls">): string {
  return PLATFORM_LABEL[c.platform] ?? host(c.profile_urls[0] ?? "web");
}

const WEB_VISIBLE = 5;

function ProfileRow({ c, decision }: { c: Candidate; decision: CandidateDecision }): React.JSX.Element {
  const badge = BADGE[decision];
  const reason = c.reasons[0];
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

function List({ title, items }: { title: string; items: string[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section className={CARD}>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

type Evidence = Brief["evidence"][number];

function EvidenceList({ items }: { items: Evidence[] }): React.JSX.Element {
  const byStep = Map.groupBy(items, (e) => e.step);
  return (
    <>
      {[...byStep].map(([step, rows]) => (
        <div key={step} className="mt-4">
          <h3 className="text-sm font-semibold">{STEP_LABEL[step] ?? step}</h3>
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

function AlsoFound({ items }: { items: Evidence[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <details className={CARD}>
      <summary className="cursor-pointer text-sm font-semibold">
        Also found, not confirmed ({String(items.length)}) — same name, identity not verified, not used in the brief
      </summary>
      <EvidenceList items={items} />
    </details>
  );
}

function DegradedNotice({ reason, evidence }: { reason: string; evidence: Evidence[] }): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-5">
      <p className="text-sm text-amber-200">AI summary unavailable: {reason}. Below is everything we confirmed, with sources.</p>
      <EvidenceList items={evidence} />
    </section>
  );
}

export function BriefView({ state }: { state: RunState }): React.JSX.Element | null {
  const { brief } = state;
  if (!brief) return null;
  const urlOf = new Map(state.sources.map((s) => [s.id, s.url]));
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  return (
    <div id="brief" className="flex scroll-mt-6 flex-col gap-4">
      {brief.degraded !== null && <DegradedNotice reason={brief.degraded} evidence={brief.evidence} />}
      {brief.per_question.map((q) => (
        <section key={q.question_id} className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">{textOf.get(q.question_id) ?? q.question_id}</h3>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${COVERAGE[q.coverage]}`}>{q.coverage}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{q.summary}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {state.claims
              .filter((c) => q.claim_ids.includes(c.id))
              .map((c) => (
                <li key={c.id} className="text-sm">
                  <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.kind === "INFERENCE" ? "bg-violet-500/15 text-violet-300" : "bg-zinc-800 text-zinc-300"}`}>
                    {c.kind}
                  </span>
                  {c.text}
                  {c.supports.map((sid) => {
                    const url = urlOf.get(sid);
                    return url !== undefined ? (
                      <a key={sid} href={url} target="_blank" rel="noreferrer" className="ml-2 text-teal-400 underline">
                        {host(url)}
                      </a>
                    ) : null;
                  })}
                </li>
              ))}
          </ul>
        </section>
      ))}
      <List title="Interview questions" items={brief.interview_questions} />
      <List title="To verify" items={brief.to_verify} />
      <List title="Not searched (and why)" items={brief.not_searched.map((n) => `${n.source}: ${n.reason}`)} />
      <AlsoFound items={brief.also_found} />
      {brief.removed_protected > 0 ? (
        <p className="text-xs text-zinc-500">{String(brief.removed_protected)} items removed (protected categories)</p>
      ) : null}
    </div>
  );
}
