/**
 * "Role fit scorecard" card (plans/013): the fit figure with a neutral bar, then every plus and minus the run found as two
 * quiet columns, each line with its kind, its effect on the figure, its sources and the question or check it leaves.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/scorecard-card.tsx
 * Deps:    react, ./scorecard (Scorecard, ScoreItem, SCORECARD_NOTE), ./evidence (Evidence), ./state (host, isCvSource, CV_SOURCE_TEXT), src/domain/url (httpUrl), ../../ui (CARD, Eyebrow, Pill, LINK, SUMMARY_COMPACT, Chevron)
 * Tested:  src/app/runs/[id]/__tests__/scorecard-card.test.ts
 *
 * Key responsibilities:
 * - ScorecardCard: nothing when the scorecard is null or has neither a figure nor a line; figure "n%" (or "—" with "no
 *   must-haves to score"), bar, "a of b must-haves evidenced, c partly"; Pluses / Minuses columns, VISIBLE lines each and the
 *   rest behind "Show all"; notes; the fixed honesty line
 * - Line: FACT / INFERENCE / CHECK label, "+14 pts" / "−14 pts" / "no effect on fit", sources as "[host]" links (CV as text),
 *   direct URLs for registry and signal lines (http(s) only), "Ask:" or "Check:" line in muted type
 *
 * Design constraints:
 * - No hooks, English only (wrapped in lang="en" inside a Czech brief by the caller); Radar tokens only, no colour scale over
 *   the figure, the bar is the Fit section's neutral bar; the pf-* motion classes animate it inside `.profile`
 * - Words rate the evidence, never the candidate
 */
import { httpUrl } from "@/domain/url";
import { CARD, Chevron, Eyebrow, LINK, SUMMARY_COMPACT } from "../../ui";
import type { Evidence } from "./evidence";
import { SCORECARD_NOTE, type ScoreItem, type Scorecard } from "./scorecard";
import { CV_SOURCE_TEXT, host, isCvSource } from "./state";

const NOTE = "text-xs text-muted";
/** Lines per column before the rest folds behind "Show all". */
export const VISIBLE = 6;

const KIND_CLASS: Record<ScoreItem["kind"], string> = { FACT: "text-ok", INFERENCE: "text-inference", CHECK: "text-muted" };

/** "+14 pts", "−14 pts" or "no effect on fit". */
export function pointsLabel(points: number): string {
  if (points === 0) return "no effect on fit";
  return `${points > 0 ? "+" : "−"}${String(Math.abs(points))} pts`;
}

/** "3 of 5 must-haves evidenced, 1 partly" / "no must-haves to score". */
export function checkedLabel(c: Scorecard["checked"]): string {
  if (c.total === 0) return "no must-haves to score";
  const partly = c.partial > 0 ? `, ${String(c.partial)} partly` : "";
  return `${String(c.evidenced)} of ${String(c.total)} must-have${c.total === 1 ? "" : "s"} evidenced${partly}`;
}

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
        return safe === null ? (
          <span key={key}>{host(url)}</span>
        ) : (
          <a key={key} href={safe} target="_blank" rel="noreferrer" className={LINK}>
            {host(url)}
          </a>
        );
      })}
    </>
  );
}

function Line({ item, evidence }: { item: ScoreItem; evidence: Evidence }): React.JSX.Element {
  const sign = item.side === "plus" ? "+" : "−";
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 border-t border-divider py-2.5 first:border-t-0">
      <span aria-hidden="true" className={`font-serif text-lg leading-6 ${item.side === "plus" ? "text-ok" : "text-conflict"}`}>
        {sign}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-ink">{item.text}</span>
        <span className={`mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${NOTE}`}>
          <span className={`font-semibold tracking-wide ${KIND_CLASS[item.kind]}`}>{item.kind}</span>
          <span className={item.points === 0 ? "" : "font-semibold text-ink tabular-nums"}>{pointsLabel(item.points)}</span>
          <Sources item={item} evidence={evidence} />
        </span>
        {item.ask !== null && <span className={`mt-1 block ${NOTE}`}>{item.ask.startsWith("Check:") ? item.ask : `Ask: ${item.ask}`}</span>}
      </span>
    </li>
  );
}

function Column({ title, items, evidence, empty }: { title: string; items: ScoreItem[]; evidence: Evidence; empty: string }): React.JSX.Element {
  const head = items.slice(0, VISIBLE);
  const rest = items.slice(VISIBLE);
  return (
    <div className="min-w-0">
      <h3 className="flex items-baseline justify-between border-b-2 border-ink pb-2 font-serif text-lg">
        {title}
        <span className={`${NOTE} tabular-nums`}>{String(items.length)}</span>
      </h3>
      {items.length === 0 ? (
        <p className={`mt-3 ${NOTE}`}>{empty}</p>
      ) : (
        <ul>
          {head.map((i) => (
            <Line key={i.id} item={i} evidence={evidence} />
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <details className="group border-t border-divider pt-2">
          <summary className={SUMMARY_COMPACT}>
            <Chevron />
            <span>{`Show all (${String(rest.length)} more)`}</span>
          </summary>
          <ul>
            {rest.map((i) => (
              <Line key={i.id} item={i} evidence={evidence} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function ScorecardCard({ card, evidence }: { card: Scorecard | null; evidence: Evidence }): React.JSX.Element | null {
  if (card === null || (card.fit === null && card.pluses.length === 0 && card.minuses.length === 0)) return null;
  return (
    <section className={`profile ${CARD}`} aria-labelledby="scorecard">
      <Eyebrow>Pluses and minuses, with evidence</Eyebrow>
      <h2 id="scorecard" className="mt-1 font-serif text-2xl">
        Role fit scorecard
      </h2>
      <div className="pf-verdict mt-4 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-5 gap-y-2">
        <p className="font-serif text-5xl leading-none text-ink tabular-nums">{card.fit === null ? "—" : `${String(card.fit)}%`}</p>
        <div className="min-w-0 pb-1">
          <p className="text-sm text-ink">
            <span className="text-muted">Fit, </span>
            {card.role ?? "the role"}
          </p>
          <p className={`mt-1 ${NOTE}`}>{checkedLabel(card.checked)}</p>
        </div>
        <div className="col-span-2">
          <Bar pct={card.fit ?? 0} />
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-8">
        <Column title="Pluses" items={card.pluses} evidence={evidence} empty="No must-have has public evidence yet." />
        <Column title="Minuses" items={card.minuses} evidence={evidence} empty="No open point found in public data." />
      </div>
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
