/**
 * Role-fit scorecard as plain lines for the interview kit and other text exports (plans/013).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/scorecard-text.ts
 * Deps:    ./scorecard (Scorecard, ScoreItem, SCORECARD_NOTE), ./scorecard-card (pointsLabel, checkedLabel), ./state (CV_SOURCE_TEXT, isCvSource)
 * Tested:  src/app/runs/[id]/__tests__/scorecard-text.test.ts
 *
 * Key responsibilities:
 * - scorecardLines(card, urlOf): "Fit, <role>: 75% (2 of 4 must-haves evidenced, 1 partly)", then one line per plus ("+") and
 *   minus ("−") with kind, points label, source hosts or URLs, and the ask; notes; the fixed honesty line; [] for null
 *
 * Design constraints:
 * - Pure; English only; the caller escapes Markdown and turns URLs into links
 */
import { SCORECARD_NOTE, type ScoreItem, type Scorecard } from "./scorecard";
import { checkedLabel, pointsLabel } from "./scorecard-card";
import { CV_SOURCE_TEXT, isCvSource } from "./state";

export type ScoreLine = { text: string; urls: string[] };

function itemLine(item: ScoreItem, urlOf: (sourceId: string) => string | null): ScoreLine {
  const urls = [...item.source_ids.flatMap((id) => { const u = urlOf(id); return u === null ? [] : [u]; }), ...item.urls];
  const cv = urls.some(isCvSource) ? ` (${CV_SOURCE_TEXT})` : "";
  const ask = item.ask === null ? "" : ` ${item.ask.startsWith("Check:") ? item.ask : `Ask: ${item.ask}`}`;
  return { text: `${item.side === "plus" ? "+" : "−"} ${item.text} [${item.kind}, ${pointsLabel(item.points)}]${cv}${ask}`, urls: urls.filter((u) => !isCvSource(u)) };
}

export function scorecardLines(card: Scorecard | null, urlOf: (sourceId: string) => string | null): ScoreLine[] {
  if (card === null || (card.fit === null && card.pluses.length === 0 && card.minuses.length === 0)) return [];
  const fit = card.fit === null ? "no must-haves to score" : `${String(card.fit)}% (${checkedLabel(card.checked)})`;
  return [
    { text: `Fit, ${card.role ?? "the role"}: ${fit}`, urls: [] },
    ...card.pluses.map((i) => itemLine(i, urlOf)),
    ...card.minuses.map((i) => itemLine(i, urlOf)),
    ...card.notes.map((n) => ({ text: n, urls: [] })),
    { text: SCORECARD_NOTE, urls: [] },
  ];
}
