/**
 * Shared pieces of the candidate profile: type scale constants, section head, capped lists and the evidence disclosure.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-evidence.tsx
 * Deps:    react, src/domain/claim (types), ../../ui (Radar primitives), ./evidence, ./state
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Evidence line (quote on a hairline rule, one meta line) and the "Evidence (n)" disclosure; an item with no kept quote says so
 * - Item rows, capped lists with "Show N more", section head, dropped-line note, citation numbering types
 */
import type { ProfileEvidence, ProfileItem } from "@/domain/claim";
import { Chevron, Eyebrow, LINK, Pill, SUMMARY, SUMMARY_COMPACT } from "../../ui";
import { type Evidence, quoteLink, retrievedLabel } from "./evidence";
import { CV_SOURCE_TEXT, host, isCvSource } from "./state";

// Three type sizes inside the block: text-xs (meta), text-sm (body), text-xl serif (headings and figures).
export const NOTE = "text-xs text-muted";
/** 65ch measure for anything read as prose (quotes, intros, details, the read). */
export const MEASURE = "max-w-prose";
export const INTRO = `mt-2 ${MEASURE} text-sm text-muted`;
export const H2 = "mt-1 scroll-mt-6 font-serif text-xl";
export const FIGURE = "font-serif text-xl leading-tight text-ink tabular-nums";

export const plural = (n: number, one: string, many = `${one}s`): string => `${String(n)} ${n === 1 ? one : many}`;

type Direction = "supports" | "contradicts" | "context";
/** `direction` is optional for briefs stored before it existed; fall back to the boolean. */
const directionOf = (e: ProfileEvidence): Direction => e.direction ?? (e.supports ? "supports" : "contradicts");
const DIRECTION: Record<Direction, { text: string; cls: string }> = {
  supports: { text: "supports", cls: "text-ok" },
  contradicts: { text: "weakens", cls: "font-semibold text-conflict" },
  context: { text: "context", cls: "text-inference" },
};

/** "Retrieved 9 Oct 2026, 10:00 UTC" → "9 Oct 2026" for the one-line evidence meta. */
const retrievedDay = (iso: string | null | undefined): string => retrievedLabel(iso).replace(/^Retrieved /, "").replace(/,.*$/, "");

/** Source number by first use, in page order, so evidence lines cite [n] and the Sources list matches. */
export type Cite = ReadonlyMap<string, number>;

export type Ctx = { evidence: Evidence; cite: Cite };

export function Dropped({ n }: { n: number }): React.JSX.Element | null {
  return n > 0 ? <p className={`mt-2 ${NOTE}`}>{plural(n, "line")} dropped by the quote check</p> : null;
}

/** Section head: eyebrow (what kind of content) over the numbered serif title. */
export function Head({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }): React.JSX.Element {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className={H2}>
        {title}
      </h2>
    </>
  );
}

/** Collapsed tail of a capped list. */
export function More({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <details className="group">
      <summary className={SUMMARY}>
        <Chevron />
        {label}
      </summary>
      {children}
    </details>
  );
}

/** Quiet quote block: serif quote on a hairline rule (conflict-tinted when it weakens), then one meta line. */
function EvidenceLine({ e, ctx }: { e: ProfileEvidence; ctx: Ctx }): React.JSX.Element {
  const info = ctx.evidence.sourceOf.get(e.source_id);
  const n = ctx.cite.get(e.source_id);
  const direction = directionOf(e);
  const dir = DIRECTION[direction];
  /** Segments never break inside (no split dates); the dot is tied to the segment before it by a no-break space, so a wrap lands after "·", never before it. */
  const seg = (key: string, node: React.ReactNode, first = false): React.JSX.Element => (
    <span key={key}>
      {first ? " " : <span aria-hidden="true">{"\u00a0· "}</span>}
      <span className="whitespace-nowrap">{node}</span>
    </span>
  );
  return (
    <li className={`border-l pl-4 ${direction === "contradicts" ? "border-conflict" : "border-divider"}`}>
      <blockquote className={`${MEASURE} font-serif text-sm text-ink`}>“{e.quote}”</blockquote>
      <p className={`mt-1 ${NOTE}`}>
        {/* A weak INFERENCE line gets no strength pill: the INFERENCE label already says it is not a checked quote. */}
        {(e.strength === "strong" || e.kind === "FACT") && (
          <Pill tone={e.strength === "strong" ? "ok" : "unsure"} className="px-2 py-0">
            {e.strength === "strong" ? "Independent" : "Self-reported"}
          </Pill>
        )}
        {seg("kind", <span className={`font-semibold tracking-wide ${e.kind === "FACT" ? "text-ok" : "text-inference"}`}>{e.kind}</span>, true)}
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
        {e.note !== "" && <span>{`\u00a0· ${e.note}`}</span>}
      </p>
    </li>
  );
}

/** `about` names the item for screen readers, so a page of "Evidence (2)" summaries stays distinguishable. Each summary part ends with its own "·" so a wrap never starts a line with it. */
export function EvidenceList({ items, ctx, about }: { items: ProfileEvidence[]; ctx: Ctx; about: string }): React.JSX.Element | null {
  if (items.length === 0) return null;
  const against = items.filter((e) => directionOf(e) === "contradicts").length;
  const independent = items.filter((e) => e.strength === "strong").length;
  return (
    <details className="group mt-1">
      <summary className={SUMMARY_COMPACT}>
        <Chevron />
        <span>
          {`Evidence (${String(items.length)})`}
          <span className="sr-only">{` for ${about}`}</span>
          {"\u00a0·"}
        </span>
        <span className={independent === 0 ? "font-medium text-unsure" : "font-medium"}>
          {independent === 0 ? "all self-reported" : `${String(independent)} independent`}
          {against > 0 && "\u00a0·"}
        </span>
        {against > 0 && <span className="text-conflict">{`${String(against)} weakens`}</span>}
      </summary>
      <ul className="mt-2 mb-2 space-y-4 [overflow-wrap:anywhere]">
        {items.map((e, i) => (
          <EvidenceLine key={`${e.source_id}-${String(i)}`} e={e} ctx={ctx} />
        ))}
      </ul>
    </details>
  );
}

/** Visible empty state: an item with no kept supporting quote says so. */
export function NoQuote(): React.JSX.Element {
  return <p className={`mt-1 ${NOTE}`}>No supporting quote kept</p>;
}

/** `quiet` drops the bold title for inference rows (working style), so they never outweigh the facts. */
function ItemRows({ items, ctx, quiet = false }: { items: ProfileItem[]; ctx: Ctx; quiet?: boolean }): React.JSX.Element {
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.text} className="py-3">
          <h3 className={`text-sm text-ink ${quiet ? "" : "font-semibold"}`}>{it.text}</h3>
          {it.detail !== "" && <p className={`mt-1 ${MEASURE} text-sm text-muted`}>{it.detail}</p>}
          {it.evidence.length === 0 ? <NoQuote /> : <EvidenceList items={it.evidence} ctx={ctx} about={it.text} />}
        </li>
      ))}
    </ul>
  );
}

export function Capped({ items, visible, ctx, quiet = false }: { items: ProfileItem[]; visible: number; ctx: Ctx; quiet?: boolean }): React.JSX.Element {
  const rest = items.slice(visible);
  return (
    <div className="mt-2">
      <ItemRows items={items.slice(0, visible)} ctx={ctx} quiet={quiet} />
      {rest.length > 0 && (
        <More label={`Show ${String(rest.length)} more`}>
          <ItemRows items={rest} ctx={ctx} quiet={quiet} />
        </More>
      )}
    </div>
  );
}
