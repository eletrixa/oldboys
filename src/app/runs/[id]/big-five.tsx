/**
 * Big Five block of the working-style section: a pentagon chart of the five leans, one bipolar row per dimension with
 * its summary and quotes, then the recommendations for working with and interviewing the person.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/big-five.tsx
 * Deps:    react, src/domain/claim (BigFive, BIG_FIVE), ../../ui (Pill, Eyebrow)
 * Tested:  src/app/runs/[id]/__tests__/big-five.test.ts
 *
 * Key responsibilities:
 * - Chart: SVG pentagon, one axis per dimension in BIG_FIVE order, the read as a filled polygon (marker position 0..100 from
 *   the centre), a dashed "balanced" ring at 50; labels at the vertices
 * - Row per dimension: plain-language poles, a bipolar track with the marker at `position` and a dashed centre tick,
 *   lean word + confidence, summary sentence, evidence through the `evidence` render prop (profile-sections owns the lines)
 * - Recommendations: numbered list, each prefixed with the dimension it follows from
 *
 * Design constraints:
 * - The number behind the marker is never printed: a lean word is the only text (brief: no personality scores);
 *   the whole block is labelled an inference from their own writing
 * - Server-safe and pure; Radar tokens only; motion hooks are the pf-* class names handled in globals.css
 */
import { BIG_FIVE, type BigFive, type BigFiveDimension, type ProfileEvidence } from "@/domain/claim";
import { Pill } from "../../ui";

export const DIMENSION: Record<BigFiveDimension, { name: string; low: string; high: string; short: string }> = {
  openness: { name: "Openness", short: "Open", low: "Practical", high: "Exploratory" },
  conscientiousness: { name: "Conscientiousness", short: "Consc.", low: "Flexible", high: "Structured" },
  extraversion: { name: "Extraversion", short: "Extra.", low: "Reserved", high: "Outgoing" },
  agreeableness: { name: "Agreeableness", short: "Agree.", low: "Challenging", high: "Accommodating" },
  neuroticism: { name: "Stress response", short: "Stress", low: "Steady", high: "Reactive" },
};

const LEAN: Record<BigFive["traits"][number]["lean"], string> = { low: "leans", balanced: "balanced", high: "leans" };

/** The lean as a sentence fragment: "leans Structured", "balanced". */
export function leanText(t: Pick<BigFive["traits"][number], "dimension" | "lean">): string {
  const d = DIMENSION[t.dimension];
  return t.lean === "balanced" ? LEAN.balanced : `${LEAN[t.lean]} ${t.lean === "high" ? d.high : d.low}`;
}

const SIZE = 240;
const R = 96;
const C = SIZE / 2;
/** Vertex k of 5, starting at the top, clockwise; `f` is the radius fraction. */
const point = (k: number, f: number): [number, number] => {
  const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
  return [C + R * f * Math.cos(a), C + R * f * Math.sin(a)];
};
const poly = (f: (k: number) => number): string => BIG_FIVE.map((_, k) => point(k, f(k)).map((v) => v.toFixed(1)).join(",")).join(" ");

export function BigFiveChart({ traits }: { traits: BigFive["traits"] }): React.JSX.Element {
  const pos = new Map(traits.map((t) => [t.dimension, t.position]));
  const dim = (k: number): BigFiveDimension => BIG_FIVE[k] ?? "openness";
  const has = (k: number): boolean => pos.has(dim(k));
  const value = (k: number): number => (pos.get(dim(k)) ?? 50) / 100;
  const title = BIG_FIVE.filter((d) => pos.has(d))
    .map((d) => `${DIMENSION[d].name} ${leanText({ dimension: d, lean: traits.find((t) => t.dimension === d)?.lean ?? "balanced" })}`)
    .join("; ");
  return (
    <svg viewBox={`0 0 ${String(SIZE)} ${String(SIZE)}`} role="img" aria-label={`Big Five chart: ${title}`} className="pf-big5 mx-auto h-auto w-full max-w-[240px]">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={poly(() => f)} fill="none" stroke="currentColor" className={f === 0.5 ? "text-line" : "text-divider"} strokeDasharray={f === 0.5 ? "3 3" : undefined} strokeWidth={1} />
      ))}
      {BIG_FIVE.map((_, k) => {
        const [x, y] = point(k, 1);
        return <line key={k} x1={C} y1={C} x2={x} y2={y} stroke="currentColor" className="text-divider" strokeWidth={1} />;
      })}
      <polygon points={poly((k) => (has(k) ? value(k) : 0.5))} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.5} className="pf-big5-shape text-inference" />
      {BIG_FIVE.map((d, k) => {
        if (!has(k)) return null;
        const [x, y] = point(k, value(k));
        return <circle key={d} cx={x} cy={y} r={3.5} fill="currentColor" className="pf-big5-dot text-inference" />;
      })}
      {BIG_FIVE.map((d, k) => {
        const [x, y] = point(k, 1.22);
        const anchor = x < C - 4 ? "end" : x > C + 4 ? "start" : "middle";
        return (
          <text key={d} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={10} fill="currentColor" className="font-semibold uppercase tracking-[0.07em] text-muted">
            {DIMENSION[d].short}
          </text>
        );
      })}
    </svg>
  );
}

type Row = BigFive["traits"][number];

function TraitRow({ t, evidence }: { t: Row; evidence: (items: ProfileEvidence[], about: string) => React.ReactNode }): React.JSX.Element {
  const d = DIMENSION[t.dimension];
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">{d.name}</h3>
        <p className="text-xs text-muted">
          <span className="font-medium text-ink">{leanText(t)}</span>
          {` · ${t.confidence} confidence`}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 text-xs text-muted">
        <span>{d.low}</span>
        <div className="relative h-1.5 rounded-full bg-divider" aria-hidden="true">
          <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-line" />
          <span className="pf-big5-marker absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-inference shadow-sm" style={{ left: `${String(t.position)}%` }} />
        </div>
        <span>{d.high}</span>
      </div>
      {t.summary !== "" && <p className="mt-2 max-w-prose text-sm text-muted">{t.summary}</p>}
      {evidence(t.evidence, d.name)}
    </li>
  );
}

export function BigFiveBlock({ big5, evidence }: { big5: BigFive; evidence: (items: ProfileEvidence[], about: string) => React.ReactNode }): React.JSX.Element {
  const rows = BIG_FIVE.flatMap((d) => big5.traits.filter((t) => t.dimension === d));
  return (
    <div className="mt-5 border-t border-divider pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-lg text-ink">Big Five lean</h3>
        <Pill tone="inference">From their own writing</Pill>
      </div>
      <div className="mt-3 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
        <BigFiveChart traits={rows} />
        <ul className="divide-y divide-divider">
          {rows.map((t) => (
            <TraitRow key={t.dimension} t={t} evidence={evidence} />
          ))}
        </ul>
      </div>
      {big5.recommendations.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">How to work with them</h3>
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
    </div>
  );
}
