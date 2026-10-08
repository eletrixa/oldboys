/**
 * Shared Radar class vocabulary and three tiny primitives used by every page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/ui.tsx
 * Deps:    react
 * Tested:  n/a (visual; docs/design/radar-ui.md is the spec)
 *
 * Key responsibilities:
 * - Class strings for cards (plain, flush, peach, sage, conflict, unsure), buttons, fields and links so pages do not drift
 * - Eyebrow, Pill (semantic tone) and SourceLink
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
export const CARD_PEACH = "rounded-2xl border border-peach bg-peach/40 p-5 md:p-6";
export const CARD_SAGE = "rounded-2xl border border-sage bg-sage/50 p-5 md:p-6";
export const CARD_CONFLICT = "rounded-2xl border border-conflict/40 bg-conflict-bg p-5 md:p-6";
export const CARD_UNSURE = "rounded-2xl border border-unsure/40 bg-unsure-bg p-5 md:p-6";

const BTN = "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm whitespace-nowrap transition-colors";
export const BTN_PRIMARY = `${BTN} bg-action px-5 font-semibold text-white hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-action`;
export const BTN_SECONDARY = `${BTN} border border-line/60 bg-surface px-4 font-medium text-ink hover:border-ink hover:bg-sage/60`;
export const BTN_QUIET = `${BTN} px-3 font-medium text-muted hover:bg-sage/60 hover:text-ink`;

/** Border and placeholder meet 3:1 / 4.5:1; focus uses the global :focus-visible ring. */
export const FIELD = "w-full rounded-lg border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted";

export const LINK = "font-medium text-action underline decoration-action/40 underline-offset-4 hover:decoration-action";

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

export function Eyebrow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-xs font-semibold tracking-[0.08em] text-action uppercase">{children}</p>;
}

/** External source link shown as its hostname. */
/** A source as a link; the pasted CV ("cv:<runId>") as plain text with no href. `label` defaults to the host. */
export function SourceLink({ url, label, className = "" }: { url: string; label?: string; className?: string }): React.JSX.Element {
  if (isCvSource(url)) return <span className={`text-zinc-400 ${className}`}>{CV_SOURCE_TEXT}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${LINK} ${className}`}>
      {label ?? host(url)}
    </a>
  );
}
