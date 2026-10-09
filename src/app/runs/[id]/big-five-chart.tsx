/**
 * Pentagon chart of the Big Five read: one axis per dimension, the read as a filled shape, full dimension names at the vertices.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/big-five-chart.tsx
 * Deps:    react, src/domain/claim (BIG_FIVE, BigFive, BigFiveDimension), ./big-five-lean
 * Tested:  src/app/runs/[id]/__tests__/big-five.test.ts
 *
 * Key responsibilities:
 * - Two rings (dashed balanced ring at the middle, solid rim) and five spokes
 * - All five read: one filled polygon; otherwise one stub per read dimension, so an unread one is never drawn as balanced
 * - Dot per read dimension, hollow for low confidence; the aria-label is the lean sentence; a caption says how to read it
 *
 * Design constraints:
 * - No number printed; Radar tokens only; motion hooks are the pf-big5-* class names handled in globals.css
 * - Centre at the viewBox centre so the CSS `transform-origin: 50% 50%` with `transform-box: view-box` is the pentagon centre
 */
import { BIG_FIVE, type BigFive, type BigFiveDimension } from "@/domain/claim";
import { DIMENSION, leanSentence } from "./big-five-lean";

const W = 400;
const H = 200;
const R = 72;
const CX = W / 2;
const CY = H / 2;
/** Vertex k of 5, starting at the top, clockwise; `f` is the radius fraction. */
const point = (k: number, f: number): [number, number] => {
  const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
  return [CX + R * f * Math.cos(a), CY + R * f * Math.sin(a)];
};
const poly = (f: (k: number) => number): string => BIG_FIVE.map((_, k) => point(k, f(k)).map((v) => v.toFixed(1)).join(",")).join(" ");

type Anchor = { dx: number; dy: number; textAnchor: "middle" | "start" | "end"; dominantBaseline: "auto" | "middle" | "hanging" };
/** Label placement by vertex: top, right, lower right, lower left, left. */
const LABEL: Anchor[] = [
  { dx: 0, dy: -8, textAnchor: "middle", dominantBaseline: "auto" },
  { dx: 8, dy: 0, textAnchor: "start", dominantBaseline: "middle" },
  { dx: 0, dy: 8, textAnchor: "start", dominantBaseline: "hanging" },
  { dx: 0, dy: 8, textAnchor: "end", dominantBaseline: "hanging" },
  { dx: -8, dy: 0, textAnchor: "end", dominantBaseline: "middle" },
];

export function BigFiveChart({ traits }: { traits: BigFive["traits"] }): React.JSX.Element {
  const byDim = new Map(traits.map((t) => [t.dimension, t]));
  const dim = (k: number): BigFiveDimension => BIG_FIVE[k] ?? "openness";
  const value = (k: number): number => (byDim.get(dim(k))?.position ?? 50) / 100;
  const full = BIG_FIVE.every((d) => byDim.has(d));
  return (
    <figure className="pf-big5-figure mx-auto w-full max-w-[320px]">
      <svg viewBox={`0 0 ${String(W)} ${String(H)}`} role="img" aria-label={`Big Five chart: ${leanSentence(traits)}`} className="pf-big5 h-auto w-full">
        <polygon points={poly(() => 0.5)} fill="none" stroke="currentColor" className="text-line" strokeDasharray="3 3" strokeWidth={1} />
        <polygon points={poly(() => 1)} fill="none" stroke="currentColor" className="text-divider" strokeWidth={1} />
        {BIG_FIVE.map((_, k) => {
          const [x, y] = point(k, 1);
          return <line key={k} x1={CX} y1={CY} x2={x} y2={y} stroke="currentColor" className="text-divider" strokeWidth={1} />;
        })}
        {full ? (
          <polygon points={poly(value)} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.5} className="pf-big5-shape text-inference" />
        ) : (
          BIG_FIVE.map((d, k) => {
            if (!byDim.has(d)) return null;
            const [x, y] = point(k, value(k));
            return <line key={d} x1={CX} y1={CY} x2={x} y2={y} stroke="currentColor" strokeWidth={1.25} className="pf-big5-stub text-inference" />;
          })
        )}
        {BIG_FIVE.map((d, k) => {
          const t = byDim.get(d);
          if (t === undefined) return null;
          const [x, y] = point(k, value(k));
          return t.confidence === "low" ? (
            <circle key={d} cx={x} cy={y} r={3.5} strokeWidth={1.5} className="pf-big5-dot fill-canvas stroke-inference" />
          ) : (
            <circle key={d} cx={x} cy={y} r={3.5} fill="currentColor" className="pf-big5-dot text-inference" />
          );
        })}
        {BIG_FIVE.map((d, k) => {
          const [vx, vy] = point(k, 1);
          const a = LABEL[k];
          if (a === undefined) return null;
          return (
            <text key={d} x={vx + a.dx} y={vy + a.dy} textAnchor={a.textAnchor} dominantBaseline={a.dominantBaseline} fontSize={13} fill="currentColor" className="text-muted">
              {DIMENSION[d].name}
            </text>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">
        From their own writing. Out to the rim = the right-hand word of its row below; dashed ring = balanced; hollow dot = low confidence.
      </figcaption>
    </figure>
  );
}
