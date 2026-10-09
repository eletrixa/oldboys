/**
 * One evidence line of the candidate profile (quote on a hairline rule, one meta line) and the Big Five own-words block.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/evidence-line.tsx
 * Deps:    react, src/domain/claim (ProfileEvidence), ../../ui (Chevron, LINK, Pill, SUMMARY_COMPACT), ./evidence, ./state
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts, src/app/runs/[id]/__tests__/big-five.test.ts
 *
 * Key responsibilities:
 * - EvidenceLine: serif quote with `cite` and a hanging opening mark; meta line FACT / INFERENCE, Independent /
 *   Self-reported pill (none on a weak INFERENCE), supports / weakens / context, [n] source deep-linked at the quote,
 *   retrieved day, note; "source missing" for an unknown id
 * - weakensFirst: weakening lines first, stored order inside each group
 * - OwnWords: Big Five quotes; first one in view unless low confidence, a weakening quote is never folded away
 * - Shared type scale (NOTE, MEASURE), citation types (Cite, Ctx) and the "No supporting quote kept" state
 *
 * Design constraints:
 * - Imports nothing from profile-evidence (no cycle); every summary segment ends with its own "·" so no line starts with one
 */
import type { ProfileEvidence } from "@/domain/claim";
import { Chevron, LINK, Pill, SUMMARY_COMPACT } from "../../ui";
import { type Evidence, quoteLink, retrievedLabel } from "./evidence";
import { CV_SOURCE_TEXT, host, isCvSource } from "./state";

// Three type sizes inside the block: text-xs (meta), text-sm (body), text-xl serif (headings and figures).
export const NOTE = "text-xs text-muted";
/** 65ch measure for anything read as prose (quotes, intros, details, the read). */
export const MEASURE = "max-w-prose";

/** Source number by first use, in page order, so evidence lines cite [n] and the Sources list matches. */
export type Cite = ReadonlyMap<string, number>;

export type Ctx = { evidence: Evidence; cite: Cite };

type Direction = "supports" | "contradicts" | "context";
/** `direction` is optional for briefs stored before it existed; fall back to the boolean. */
export const directionOf = (e: ProfileEvidence): Direction => e.direction ?? (e.supports ? "supports" : "contradicts");
const DIRECTION: Record<Direction, { text: string; cls: string }> = {
  supports: { text: "supports", cls: "text-ok" },
  contradicts: { text: "weakens", cls: "font-semibold text-conflict" },
  context: { text: "context", cls: "text-inference" },
};

/** Weakening lines first so one is never last under a fold; stored order inside each group. */
export const weakensFirst = (items: ProfileEvidence[]): ProfileEvidence[] => [
  ...items.filter((e) => directionOf(e) === "contradicts"),
  ...items.filter((e) => directionOf(e) !== "contradicts"),
];

/** "Retrieved 9 Oct 2026, 10:00 UTC" → "9 Oct 2026" for the one-line evidence meta. */
const retrievedDay = (iso: string | null | undefined): string => retrievedLabel(iso).replace(/^Retrieved /, "").replace(/,.*$/, "");

/** Visible empty state: an item with no kept supporting quote says so. */
export function NoQuote(): React.JSX.Element {
  return <p className={`mt-1 ${NOTE}`}>No supporting quote kept</p>;
}

/** Quiet quote block: serif quote on a hairline rule (conflict-tinted when it weakens), then one meta line. */
export function EvidenceLine({ e, ctx }: { e: ProfileEvidence; ctx: Ctx }): React.JSX.Element {
  const info = ctx.evidence.sourceOf.get(e.source_id);
  const n = ctx.cite.get(e.source_id);
  const direction = directionOf(e);
  const dir = DIRECTION[direction];
  /** Segments never break inside (no split dates); the dot is tied to the segment before it by a no-break space, so a wrap lands after "·", never before it. */
  const seg = (key: string, node: React.ReactNode, first = false): React.JSX.Element => (
    <span key={key}>
      {first ? " " : <span aria-hidden="true">{" · "}</span>}
      <span className="whitespace-nowrap">{node}</span>
    </span>
  );
  return (
    <li className={`border-l pl-4 ${direction === "contradicts" ? "border-conflict" : "border-divider"}`}>
      <blockquote cite={info !== undefined && !isCvSource(info.url) ? info.url : undefined} className={`${MEASURE} [text-indent:-0.45em] font-serif text-sm text-ink`}>
        “{e.quote}”
      </blockquote>
      <p className={`mt-1 ${NOTE}`}>
        {seg("kind", <span className={`font-semibold tracking-wide ${e.kind === "FACT" ? "text-ok" : "text-inference"}`}>{e.kind}</span>, true)}
        {/* A weak INFERENCE line gets no strength pill: the INFERENCE label already says it is not a checked quote. */}
        {(e.strength === "strong" || e.kind === "FACT") &&
          seg(
            "who",
            <Pill tone={e.strength === "strong" ? "ok" : "unsure"} className="px-2 py-0">
              {e.strength === "strong" ? "Independent" : "Self-reported"}
            </Pill>,
          )}
        {seg("dir", <span className={dir.cls}>{dir.text}</span>)}
        {seg(
          "src",
          info === undefined || n === undefined ? (
            <span>source missing</span>
          ) : isCvSource(info.url) ? (
            <span>{`[${String(n)}] ${CV_SOURCE_TEXT}`}</span>
          ) : (
            <a href={quoteLink(info.url, e.quote)} target="_blank" rel="noreferrer" title={info.url} className={`${LINK} pf-link`}>
              {`[${String(n)}] ${host(info.url)}`}
            </a>
          ),
        )}
        {info !== undefined && seg("day", <span className="tabular-nums">{retrievedDay(info.fetched_at)}</span>)}
        {e.note !== "" && <span>{` · ${e.note}`}</span>}
      </p>
    </li>
  );
}

const LIST = "mt-2 mb-2 space-y-4 [overflow-wrap:anywhere]";
const lines = (items: ProfileEvidence[], ctx: Ctx): React.JSX.Element[] => items.map((e, i) => <EvidenceLine key={`${e.source_id}-${String(i)}`} e={e} ctx={ctx} />);

/**
 * Big Five quotes, own writing by construction (so no "all self-reported" count; the per-line pill stays). `open` puts the
 * first line in view; a weakening line is always in view because weakensFirst puts it first and forces the inline state.
 */
export function OwnWords({ items, ctx, about, open }: { items: ProfileEvidence[]; ctx: Ctx; about: string; open: boolean }): React.JSX.Element {
  const sorted = weakensFirst(items);
  const [head] = sorted;
  if (head === undefined) return <NoQuote />;
  if (open || directionOf(head) === "contradicts") {
    const rest = sorted.slice(1);
    const restAgainst = rest.filter((e) => directionOf(e) === "contradicts").length;
    return (
      <>
        <ul className="mt-2 space-y-4 [overflow-wrap:anywhere]">{lines([head], ctx)}</ul>
        {rest.length > 0 && (
          <details className="group mt-1">
            <summary className={SUMMARY_COMPACT}>
              <Chevron />
              <span>
                {`Show ${String(rest.length)} more quote${rest.length === 1 ? "" : "s"}`}
                <span className="sr-only">{` for ${about}`}</span>
                {restAgainst > 0 && " ·"}
              </span>
              {restAgainst > 0 && <span className="text-conflict">{`${String(restAgainst)} weakens`}</span>}
            </summary>
            <ul className={LIST}>{lines(rest, ctx)}</ul>
          </details>
        )}
      </>
    );
  }
  // Collapsed only when no line weakens (a weakening line forces the inline state above), so no weakens count here.
  const facts = items.filter((e) => e.kind === "FACT").length;
  return (
    <details className="group mt-1">
      <summary className={SUMMARY_COMPACT}>
        <Chevron />
        <span>
          {`Their own words (${String(items.length)})`}
          <span className="sr-only">{` for ${about}`}</span>
          {" ·"}
        </span>
        <span className={facts === 0 ? "font-medium text-inference" : "font-medium text-ok"}>
          {facts === 0 ? "all inference" : `${String(facts)} FACT`}
        </span>
      </summary>
      <ul className={LIST}>{lines(sorted, ctx)}</ul>
    </details>
  );
}
