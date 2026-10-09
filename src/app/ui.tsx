/**
 * Shared Radar class vocabulary and three tiny primitives used by every page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/ui.tsx
 * Deps:    react
 * Tested:  n/a (visual; docs/design/radar-ui.md is the spec)
 *
 * Key responsibilities:
 * - Class strings for cards (plain, flush, muted, peach, sage, conflict, unsure), buttons (primary, secondary, quiet, danger), fields
 *   and links so pages do not drift
 * - Eyebrow, Pill (semantic tone), SourceLink, and the SUMMARY + Chevron disclosure pattern
 * - SimulatedPill: the one label for anything not live (MOCK call, CACHED stored run, NO AI brief); /validation lists them
 *
 * Design constraints:
 * - Semantic tokens only (canvas, surface, ink, muted, action, sage, peach, divider, ok, unsure, conflict, inference)
 * - Server-safe: no hooks, no browser APIs
 */
import { CV_SOURCE_TEXT, host, isCvSource } from "./runs/[id]/state";

const SHADOW = "shadow-[0_8px_30px_rgba(40,45,43,0.06)]";

const CARD_BASE = "rounded-2xl border border-divider bg-surface";
export const CARD = `${CARD_BASE} p-5 md:p-6 ${SHADOW}`;
/** A card whose content runs edge to edge (tables); no padding. */
export const CARD_FLUSH = `${CARD_BASE} overflow-hidden ${SHADOW}`;
/** Recessed card for inference-only content (working style): canvas fill, no shadow, never louder than CARD. */
export const CARD_MUTED = "rounded-2xl border border-divider bg-canvas p-5 md:p-6";
export const CARD_PEACH = "rounded-2xl border border-peach bg-peach/40 p-5 md:p-6";
export const CARD_SAGE = "rounded-2xl border border-sage bg-sage/50 p-5 md:p-6";
export const CARD_CONFLICT = "rounded-2xl border border-conflict/40 bg-conflict-bg p-5 md:p-6";
export const CARD_UNSURE = "rounded-2xl border border-unsure/40 bg-unsure-bg p-5 md:p-6";

const BTN = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm whitespace-nowrap transition-colors";
export const BTN_PRIMARY = `${BTN} bg-action px-5 font-semibold text-white hover:bg-action-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-action`;
export const BTN_SECONDARY = `${BTN} border border-line bg-surface px-4 font-medium text-ink hover:border-ink hover:bg-sage/60 active:bg-sage`;
export const BTN_QUIET = `${BTN} px-3 font-medium text-muted hover:bg-sage/60 hover:text-ink active:bg-sage`;
/** Irreversible actions only (delete candidate data); conflict tone so it never looks like the primary path. */
export const BTN_DANGER = `${BTN} bg-conflict px-5 font-semibold text-white hover:bg-conflict/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50`;

/** Border and placeholder meet 3:1 / 4.5:1; focus uses the global :focus-visible ring. */
export const FIELD = "w-full rounded-lg border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted";

export const LINK = "font-medium whitespace-nowrap text-action underline decoration-action/40 underline-offset-4 hover:decoration-action";

/** `<details className="group">` + `<summary className={SUMMARY}><Chevron />…</summary>`: 44px target, native marker hidden; rounded so the global focus ring reads as a control. */
export const SUMMARY =
  "flex min-h-11 cursor-pointer list-none items-center rounded-sm gap-2 text-sm font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden";

/** SUMMARY for dense rows (evidence under each item): 32px target, above the WCAG 2.2 24px minimum, smaller type; parts wrap whole on narrow columns. */
export const SUMMARY_COMPACT =
  "flex min-h-8 cursor-pointer list-none flex-wrap rounded-sm items-center gap-x-2 text-xs font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden [&>span]:whitespace-nowrap";

/** Disclosure marker that turns when the parent `details.group` is open. */
export function Chevron(): React.JSX.Element {
  return (
    <span aria-hidden="true" className="inline-block w-3 text-base leading-none text-action transition-transform group-open:rotate-90 motion-reduce:transition-none">
      ›
    </span>
  );
}

export type Tone = "ok" | "unsure" | "conflict" | "neutral" | "inference";

const PILL: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  unsure: "bg-unsure-bg text-unsure",
  conflict: "bg-conflict-bg text-conflict",
  neutral: "bg-sage/60 text-muted",
  inference: "bg-inference-bg text-inference",
};

export function Pill({ tone, children, className = "" }: { tone: Tone; children: React.ReactNode; className?: string }): React.JSX.Element {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[tone]} ${className}`}>{children}</span>;
}

export type Simulated = "mock" | "cached" | "no-ai";

const SIMULATED: Record<Simulated, { label: string; tone: Tone; title: string }> = {
  mock: { label: "MOCK", tone: "unsure", title: "Simulated: no real phone call was made; the answers are canned." },
  cached: { label: "CACHED", tone: "neutral", title: "Stored copy of a finished run; no source was fetched again." },
  "no-ai": { label: "NO AI", tone: "unsure", title: "The AI summary did not run; only confirmed evidence is listed." },
};

/** Visible label for something simulated, replayed or degraded; `detail` follows the label after a middle dot. */
export function SimulatedPill({ kind, detail, className = "" }: { kind: Simulated; detail?: string; className?: string }): React.JSX.Element {
  const s = SIMULATED[kind];
  return (
    <Pill tone={s.tone} className={className}>
      <span title={s.title}>{detail === undefined ? s.label : `${s.label} · ${detail}`}</span>
    </Pill>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-xs font-semibold tracking-[0.08em] text-action uppercase">{children}</p>;
}

/** A source as a link; the pasted CV ("cv:<runId>") as plain text with no href. `label` defaults to the host. */
export function SourceLink({ url, label, className = "" }: { url: string; label?: string; className?: string }): React.JSX.Element {
  if (isCvSource(url)) return <span className={`text-muted ${className}`}>{CV_SOURCE_TEXT}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${LINK} ${className}`}>
      {label ?? host(url)}
    </a>
  );
}
