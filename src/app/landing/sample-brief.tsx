/**
 * Sample brief: a static, readable excerpt of the run page for a fictional candidate, rendered as live HTML.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/sample-brief.tsx
 * Deps:    ../ui
 * Tested:  n/a (visual; e2e/home.spec.ts checks the landing renders)
 *
 * Key responsibilities:
 * - The 30-second summary, one evidenced requirement with its quote and source, one requirement with no evidence,
 *   and the research-limits line, each marked 1–3 so the callouts beside it can point at them
 * - Same words and states the real run page uses (evidenced / none, FACT, Show evidence, not searched)
 *
 * Design constraints:
 * - Fictional candidate and employer only; no live data, no links out
 * - Text stays at 13px or larger so the proof is readable on a phone
 */
import { Pill } from "../ui";

function Marker({ n }: Readonly<{ n: number }>): React.JSX.Element {
  return (
    <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-action font-serif text-xs text-white tabular-nums">
      {n}
    </span>
  );
}

export function SampleBrief(): React.JSX.Element {
  return (
    <figure className="overflow-hidden rounded-2xl border border-divider bg-surface shadow-[0_24px_60px_rgba(40,45,43,0.12)]">
      <div aria-hidden="true" className="flex items-center gap-1.5 border-b border-divider bg-canvas px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-divider" />
        <span className="size-2.5 rounded-full bg-divider" />
        <span className="size-2.5 rounded-full bg-divider" />
        <span className="ml-3 rounded-md bg-surface px-3 py-0.5 text-xs text-muted">Candidate brief · fictional example</span>
      </div>
      <div className="flex flex-col gap-4 p-4 text-[13px] sm:p-5 sm:text-sm">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-action uppercase">Candidate brief</p>
          <p className="font-serif text-2xl">Jan&apos;s brief</p>
          <p className="text-muted">Senior Data Engineer at Acme</p>
        </div>

        <div className="relative rounded-xl border border-divider border-l-[3px] border-l-action bg-canvas p-4">
          <p className="flex items-center gap-2 font-serif text-lg">
            <Marker n={1} />
            In 30 seconds
          </p>
          <dl className="mt-2 flex flex-col divide-y divide-divider">
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-1.5">
              <dt className="font-semibold text-ok">Confirmed</dt>
              <dd>LinkedIn and GitHub profiles; 2 of 4 role criteria have evidence, 1 partly.</dd>
            </div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-1.5">
              <dt className="font-semibold text-unsure">Missing</dt>
              <dd>No evidence for “Has led a team of at least three engineers”.</dd>
            </div>
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-1.5">
              <dt className="font-semibold text-action">Ask</dt>
              <dd>Walk me through the pipeline you built at Acme and how you tested it.</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-divider p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Marker n={2} />
              <p className="font-semibold">Writes production SQL</p>
            </div>
            <Pill tone="ok">evidenced</Pill>
          </div>
          <p className="mt-2 flex items-start gap-2">
            <Pill tone="ok" className="mt-0.5">FACT</Pill>
            <span>Owns the SQL for Acme&apos;s nightly reporting pipelines.</span>
          </p>
          <p className="mt-2 font-serif leading-snug">
            <span className="bg-peach/70 box-decoration-clone px-0.5">“I own the SQL behind our nightly reporting pipelines and the tests around them.”</span>
          </p>
          <p className="mt-1.5 text-xs text-muted">
            linkedin.com · read 3 Oct · <span className="font-semibold text-action">Show evidence</span>
          </p>
        </div>

        <div className="rounded-xl border border-divider p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Has led a team of at least three engineers</p>
            <Pill tone="unsure">none</Pill>
          </div>
          <p className="mt-2 text-muted">No public source mentions this. Ask in the interview or a reference check.</p>
        </div>

        <p className="flex items-start gap-2 text-xs text-muted">
          <Marker n={3} />
          <span>Searched LinkedIn, GitHub, personal blog and Stack Overflow. Not searched: X (rate limited). Nothing about private life was collected.</span>
        </p>
      </div>
    </figure>
  );
}
