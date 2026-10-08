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
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { formatDuration, type RunCost } from "@/domain/run-cost";
import type { RowState, RunState } from "./state";

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5";

function Mark({ state }: { state: RowState }): React.JSX.Element {
  if (state === "done") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-teal-500 text-xs text-zinc-950">
        ✓
      </span>
    );
  }
  if (state === "active") {
    return <span className="size-5 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />;
  }
  return <span className="size-5 rounded-full border-2 border-zinc-700" />;
}

export function ProgressSteps({ rows, labels }: { rows: RowState[]; labels: string[] }): React.JSX.Element {
  const done = rows.filter((r) => r === "done").length;
  return (
    <div className="flex flex-col gap-4">
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuenow={done} aria-valuemax={5}>
        <div className="h-full bg-teal-500 transition-all" style={{ width: `${String(done * 20)}%` }} />
      </div>
      <ul className="flex flex-col gap-3">
        {labels.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 ${rows[i] === "todo" ? "text-zinc-500" : ""}`}>
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

function Icon({ platform }: { platform: string }): React.JSX.Element {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-semibold uppercase">
      {platform.slice(0, 2)}
    </span>
  );
}

export function ProfileList({
  candidates,
  decisionOf,
}: {
  candidates: Candidate[];
  decisionOf: (c: Candidate) => CandidateDecision;
}): React.JSX.Element {
  return (
    <section className={CARD}>
      <h2 className="mb-3 font-semibold">Profiles we found</h2>
      <ul className="flex flex-col gap-3">
        {candidates.map((c) => {
          const badge = BADGE[decisionOf(c)];
          return (
            <li key={c.id} className="flex items-center gap-3">
              <Icon platform={c.platform} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">{c.platform}</p>
                <p className="truncate text-sm text-zinc-400">{c.snippet}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${badge.cls}`}>{badge.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type Answer = CandidateDecision;

export function QuestionCard({
  candidate,
  onAnswer,
}: {
  candidate: Candidate;
  onAnswer: (id: string, answer: Answer) => void;
}): React.JSX.Element {
  const btn = "rounded-xl border border-amber-700/60 px-4 py-2 text-sm hover:bg-amber-500/10";
  return (
    <section className="rounded-2xl border border-amber-700/50 bg-amber-950/30 p-5">
      <h2 className="font-semibold text-amber-200">Quick question: is this {candidate.platform} account also them?</h2>
      <p className="mt-2 text-sm">{candidate.handle ?? candidate.name}</p>
      <p className="text-sm text-zinc-400">{candidate.snippet}</p>
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

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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

export function BriefView({ state }: { state: RunState }): React.JSX.Element | null {
  const { brief } = state;
  if (!brief) return null;
  const urlOf = new Map(state.sources.map((s) => [s.id, s.url]));
  const textOf = new Map(state.questions.map((q) => [q.id, q.text]));
  return (
    <div id="brief" className="flex flex-col gap-4">
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
      {brief.removed_protected > 0 ? (
        <p className="text-xs text-zinc-500">{String(brief.removed_protected)} items removed (protected categories)</p>
      ) : null}
    </div>
  );
}
