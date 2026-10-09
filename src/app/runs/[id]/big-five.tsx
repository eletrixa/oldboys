/**
 * Big Five block of the working-style section: the lean sentence, recommendations, the pentagon chart, then one bipolar
 * row per dimension with its summary and own-words quotes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/big-five.tsx
 * Deps:    react, src/domain/claim (BigFive, BIG_FIVE, ProfileEvidence), ../../ui (KEY), ./big-five-lean, ./big-five-chart
 * Tested:  src/app/runs/[id]/__tests__/big-five.test.ts
 *
 * Key responsibilities:
 * - Lead: the deterministic lean sentence in serif, then "How to work with them" (each line prefixed with its dimension);
 *   the chart sits beside both from md up, below them on phones
 * - Row per dimension (h4 under the block's h3): name, lean in serif with the confidence words, a bipolar track whose
 *   pointed-to pole word is in ink, summary, evidence through the `evidence` render prop (profile-style owns the lines)
 * - Hollow marker = low confidence, the same meaning as the hollow chart dot
 *
 * Design constraints:
 * - The number behind the marker is never printed: a lean word is the only text (brief: no personality scores);
 *   the section deck and the chart caption label it an inference from their own writing
 * - Server-safe and pure; Radar tokens only; chart and lean text live in sibling files; motion hooks are pf-big5-* in globals.css
 */
import { BIG_FIVE, type BigFive, type ProfileEvidence } from "@/domain/claim";
import { KEY } from "../../ui";
import { BigFiveChart } from "./big-five-chart";
import { DIMENSION, leanLabel, leanSentence } from "./big-five-lean";

type Row = BigFive["traits"][number];
/** `open` = the first quote may sit in view (not low confidence); the caller decides how to show the lines. */
type Evidence = (items: ProfileEvidence[], about: string, open: boolean) => React.ReactNode;

function TraitRow({ t, evidence }: { t: Row; evidence: Evidence }): React.JSX.Element {
  const d = DIMENSION[t.dimension];
  return (
    <li className="pf-big5-row py-3.5">
      <h4 className={KEY}>{d.name}</h4>
      <p className="mt-0.5 font-serif text-base text-ink">
        {leanLabel(t)}
        <span className="font-sans text-xs text-muted">{` · ${t.confidence} confidence`}</span>
      </p>
      <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 text-xs text-muted">
        <span className={t.lean === "low" ? "text-ink" : ""}>{d.low}</span>
        <div className="pf-big5-track relative h-1.5 rounded-full bg-divider" aria-hidden="true">
          <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-line" />
          <span
            className={`pf-big5-marker absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${t.confidence === "low" ? "border-inference bg-canvas" : "border-paper bg-inference"}`}
            style={{ left: `${String(t.position)}%` }}
          />
        </div>
        <span className={t.lean === "high" ? "text-ink" : ""}>{d.high}</span>
      </div>
      {t.summary !== "" && <p className="mt-2 max-w-prose text-sm text-ink">{t.summary}</p>}
      {evidence(t.evidence, d.name, t.confidence !== "low")}
    </li>
  );
}

export function BigFiveBlock({ big5, evidence }: { big5: BigFive; evidence: Evidence }): React.JSX.Element {
  const rows = BIG_FIVE.flatMap((d) => big5.traits.filter((t) => t.dimension === d));
  return (
    <div className="mt-5 border-t border-divider pt-4">
      <h3 className="font-serif text-lg text-ink">Big Five lean</h3>
      <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-start md:gap-8">
        <p className="pf-big5-lead max-w-prose font-serif text-base text-ink md:col-start-1">{leanSentence(rows)}</p>
        {big5.recommendations.length > 0 && (
          <div className="md:col-start-1">
            <h4 className={KEY}>How to work with them</h4>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink">
              {big5.recommendations.map((r, i) => (
                <li key={i} className="max-w-prose">
                  {r.dimension !== null && <span className="text-xs font-semibold tracking-[0.07em] text-muted uppercase">{`${DIMENSION[r.dimension].name} · `}</span>}
                  {r.text}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="md:col-start-2 md:row-span-2 md:row-start-1">
          <BigFiveChart traits={rows} />
        </div>
      </div>
      <ul className="mt-4 divide-y divide-divider border-t border-divider">
        {rows.map((t) => (
          <TraitRow key={t.dimension} t={t} evidence={evidence} />
        ))}
      </ul>
    </div>
  );
}
