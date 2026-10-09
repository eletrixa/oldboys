/**
 * "Role fit scorecard" card (plans/013): the fit figure with a neutral bar, then every plus and minus the run found as two
 * quiet columns, each line with its kind, its effect on the figure, its sources and the question or check it leaves.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/scorecard-card.tsx
 * Deps:    react (Fragment), ./scorecard (Scorecard, ScoreItem, labels, hasScorecard, SCORECARD_NOTE), ./evidence (Evidence), ./state (host, isCvSource, CV_SOURCE_TEXT), src/domain/url (httpUrl), ../../ui (CARD, Eyebrow, KEY, LINK, SUMMARY_COMPACT, Chevron)
 * Tested:  src/app/runs/[id]/__tests__/scorecard-card.test.ts
 *
 * Key responsibilities:
 * - ScorecardCard: nothing when the scorecard is null or has neither a figure nor a line; figure "n%" (or "—" with "no
 *   must-haves to score"), bar, "a of b must-haves evidenced, c partly"; Pluses / Minuses columns, VISIBLE lines each and the
 *   rest behind "Show all"; notes; the fixed honesty line
 * - Line: FACT / INFERENCE / CLAIMED / CHECK label, "+14 pts" / "−14 pts" and "weight n" on must-have lines; open points (0)
 *   sit under one group label (OPEN_POINTS_LABEL) instead of a label per line; sources
 * - Checks block (CHECKS_TITLE): registry records and account facts under the columns with a "?" glyph, counted in neither column
 * - Header: the evidence sentence ("2 of 4 must-haves evidenced, 1 partly") leads in serif, the weighted % stands beside it smaller as "[host]" links (CV as text),
 *   direct URLs for registry and signal lines (http(s) only), "Ask:" or "Check:" line in muted type
 *
 * Design constraints:
 * - No hooks, English only (wrapped in lang="en" inside a Czech brief by the caller); Radar tokens only, no colour scale over
 *   the figure, the bar is the Fit section's neutral bar; the pf-* motion classes animate it inside `.profile`
 * - Words rate the evidence, never the candidate
 */
import { httpUrl } from "@/domain/url";
import { Fragment } from "react";
import { CARD, Chevron, Eyebrow, KEY, LINK, SUMMARY_COMPACT } from "../../ui";
import type { Evidence } from "./evidence";
import { askLine, checkedLabel, hasScorecard, pointsLabel, SCORECARD_NOTE, type ScoreItem, type Scorecard } from "./scorecard";
import { CV_SOURCE_TEXT, host, isCvSource } from "./state";

const NOTE = "text-xs text-muted";
/** Lines per column before the rest folds behind "Show all". */
export const VISIBLE = 6;
/** Heading of the records block under the two columns. */
export const CHECKS_TITLE = "Checked, unresolved";

const KIND_CLASS: Record<ScoreItem["kind"], string> = { FACT: "text-ok", INFERENCE: "text-inference", CLAIMED: "text-unsure", CHECK: "text-muted" };

/** "weight 2" for a must-have line. */
export const weightLabel = (w: number): string => `weight ${String(w)}`;

function Bar({ pct }: { pct: number }): React.JSX.Element {
  return (
    <span aria-hidden="true" className="block h-1.5 w-full overflow-hidden rounded-full bg-divider">
      <span className="pf-bar block h-full rounded-full bg-ink" style={{ width: `${String(Math.min(100, Math.max(0, pct)))}%` }} />
    </span>
  );
}

function Sources({ item, evidence }: { item: ScoreItem; evidence: Evidence }): React.JSX.Element | null {
  const links = [
    ...item.source_ids.flatMap((id) => {
      const info = evidence.sourceOf.get(id);
      return info === undefined ? [] : [{ key: id, url: info.url }];
    }),
    ...item.urls.map((url, i) => ({ key: `u${String(i)}`, url })),
  ];
  if (links.length === 0) return null;
  return (
    <>
      {links.map(({ key, url }) => {
        if (isCvSource(url)) return <span key={key}>{CV_SOURCE_TEXT}</span>;
        const safe = httpUrl(url);
        // An unparseable or non-http URL (never expected from the run) is dropped rather than printed.
        return safe === null ? null : (
          <a key={key} href={safe} target="_blank" rel="noreferrer" className={LINK}>
            {host(url)}
          </a>
        );
      })}
    </>
  );
}

/** Group label between the must-have lines (points) and the open points (0); the lines under it drop the per-line label. */
export const OPEN_POINTS_LABEL = "No effect on fit, for the interview";

function Line({ item, evidence }: { item: ScoreItem; evidence: Evidence }): React.JSX.Element {
  const glyph = item.side === "plus" ? "+" : item.side === "minus" ? "\u2212" : "?";
  const tone = item.side === "plus" ? "text-ok" : item.side === "minus" ? "text-conflict" : "text-muted";
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 border-t border-divider py-2.5 first:border-t-0">
      <span aria-hidden="true" className={`font-serif text-lg leading-6 ${tone}`}>
        {glyph}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-ink">{item.text}</span>
        <span className={`mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${NOTE}`}>
          <span className={`font-semibold tracking-wide ${KIND_CLASS[item.kind]}`}>{item.kind}</span>
          {item.points !== 0 && <span className="font-semibold text-ink tabular-nums">{pointsLabel(item.points)}</span>}
          {item.weight !== null && <span className="tabular-nums">{weightLabel(item.weight)}</span>}
          <Sources item={item} evidence={evidence} />
        </span>
        {item.ask !== null && <span className={`mt-1 block ${NOTE}`}>{askLine(item.ask)}</span>}
      </span>
    </li>
  );
}

/** Lines in order, with the group label once, before the first open point. */
function Lines({ items, evidence, labelled }: { items: ScoreItem[]; evidence: Evidence; labelled: boolean }): React.JSX.Element {
  const first = items.findIndex((i) => i.points === 0);
  return (
    <ul>
      {items.map((i, n) => (
        <Fragment key={i.id}>
          {labelled && n === first && <li className={`${KEY} border-t border-divider pt-3 pb-1`}>{OPEN_POINTS_LABEL}</li>}
          <Line item={i} evidence={evidence} />
        </Fragment>
      ))}
    </ul>
  );
}

function Column({ title, items, evidence, empty }: { title: string; items: ScoreItem[]; evidence: Evidence; empty: string }): React.JSX.Element {
  const head = items.slice(0, VISIBLE);
  const rest = items.slice(VISIBLE);
  // The label belongs to the first list that holds an open point; the rest never repeats it.
  const labelRest = head.every((i) => i.points !== 0);
  return (
    <div className="min-w-0">
      <h3 className="flex items-baseline justify-between border-b-2 border-ink pb-2 font-serif text-lg">
        {title}
        <span className={`${NOTE} tabular-nums`}>{String(items.length)}</span>
      </h3>
      {items.length === 0 ? <p className={`mt-3 ${NOTE}`}>{empty}</p> : <Lines items={head} evidence={evidence} labelled />}
      {rest.length > 0 && (
        <details className="group border-t border-divider pt-2">
          <summary className={SUMMARY_COMPACT}>
            <Chevron />
            <span>{`Show all (${String(rest.length)} more)`}</span>
          </summary>
          <Lines items={rest} evidence={evidence} labelled={labelRest} />
        </details>
      )}
    </div>
  );
}

export function ScorecardCard({ card, evidence }: { card: Scorecard | null; evidence: Evidence }): React.JSX.Element | null {
  if (!hasScorecard(card)) return null;
  return (
    <section className={`profile ${CARD}`} aria-labelledby="scorecard">
      <Eyebrow>Pluses and minuses, with evidence</Eyebrow>
      <h2 id="scorecard" className="mt-1 font-serif text-2xl">
        Role fit scorecard
      </h2>
      {/* The evidence sentence leads; the weighted figure stands beside it, smaller, so the page reads as a count, not a grade. */}
      <div className="pf-verdict mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-5 gap-y-2">
        <div className="min-w-0">
          <p className="font-serif text-2xl leading-tight text-ink">{checkedLabel(card.checked)}</p>
          <p className={`mt-1 ${NOTE}`}>
            <span>{card.role ?? "the role"}</span>
            {card.fit !== null && <span>{" · weighted fit, see each line's points and weight"}</span>}
          </p>
        </div>
        <p className="font-serif text-3xl leading-none text-ink tabular-nums">{card.fit === null ? "\u2014" : `${String(card.fit)}%`}</p>
        <div className="col-span-2">
          <Bar pct={card.fit ?? 0} />
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-8">
        <Column title="Pluses" items={card.pluses} evidence={evidence} empty="No must-have has public evidence yet." />
        <Column title="Minuses" items={card.minuses} evidence={evidence} empty="No open point found in public data." />
      </div>
      {card.checks.length > 0 && (
        <div className="mt-6">
          <h3 className="flex items-baseline justify-between border-b border-divider pb-2 font-serif text-lg">
            {CHECKS_TITLE}
            <span className={`${NOTE} tabular-nums`}>{String(card.checks.length)}</span>
          </h3>
          <p className={`mt-2 ${NOTE}`}>Public records and account facts found under the name. Not a minus: each is a question with its link.</p>
          <Lines items={card.checks} evidence={evidence} labelled={false} />
        </div>
      )}
      {card.notes.length > 0 && (
        <ul className={`mt-4 space-y-1 ${NOTE}`}>
          {card.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className={`mt-4 border-t border-divider pt-4 ${NOTE}`}>{SCORECARD_NOTE}</p>
    </section>
  );
}
