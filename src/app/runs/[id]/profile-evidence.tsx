/**
 * Shared pieces of the candidate profile: type scale constants, section head, capped lists and the evidence disclosure.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-evidence.tsx
 * Deps:    react, src/domain/claim (types), ../../ui (Radar primitives), ./evidence-line
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - "Evidence (n)" disclosure; summary segments in fixed order: count · k FACT / all inference · n independent /
 *   all self-reported · k weakens; the open list puts weakening lines first
 * - Item rows (an item with no kept quote says so), capped lists with "Show N more", section head, dropped-line note
 */
import type { ProfileEvidence, ProfileItem } from "@/domain/claim";
import { Chevron, Eyebrow, SUMMARY, SUMMARY_COMPACT } from "../../ui";
import { type Ctx, directionOf, EvidenceLine, MEASURE, NOTE, NoQuote, weakensFirst } from "./evidence-line";

export const INTRO = `mt-2 ${MEASURE} text-sm text-muted`;
export const H2 = "mt-1 scroll-mt-6 font-serif text-xl";
export const FIGURE = "font-serif text-xl leading-tight text-ink tabular-nums";

export const plural = (n: number, one: string, many = `${one}s`): string => `${String(n)} ${n === 1 ? one : many}`;

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

/** `about` names the item for screen readers, so a page of "Evidence (2)" summaries stays distinguishable. Each summary part ends with its own "·" so a wrap never starts a line with it. */
export function EvidenceList({ items, ctx, about }: { items: ProfileEvidence[]; ctx: Ctx; about: string }): React.JSX.Element | null {
  if (items.length === 0) return null;
  const against = items.filter((e) => directionOf(e) === "contradicts").length;
  const independent = items.filter((e) => e.strength === "strong").length;
  const facts = items.filter((e) => e.kind === "FACT").length;
  return (
    <details className="group mt-1">
      <summary className={SUMMARY_COMPACT}>
        <Chevron />
        <span>
          {`Evidence (${String(items.length)})`}
          <span className="sr-only">{` for ${about}`}</span>
          {" ·"}
        </span>
        <span className={facts === 0 ? "font-medium text-inference" : "font-medium text-ok"}>
          {facts === 0 ? "all inference" : `${String(facts)} FACT`}
          {" ·"}
        </span>
        <span className={independent === 0 ? "font-medium text-unsure" : "font-medium"}>
          {independent === 0 ? "all self-reported" : `${String(independent)} independent`}
          {against > 0 && " ·"}
        </span>
        {against > 0 && <span className="text-conflict">{`${String(against)} weakens`}</span>}
      </summary>
      <ul className="mt-2 mb-2 space-y-4 [overflow-wrap:anywhere]">
        {weakensFirst(items).map((e, i) => (
          <EvidenceLine key={`${e.source_id}-${String(i)}`} e={e} ctx={ctx} />
        ))}
      </ul>
    </details>
  );
}

/** `quiet` sets inference rows (working style) as serif figures instead of bold titles, so they never outweigh the facts. */
export function ItemRows({ items, ctx, quiet = false }: { items: ProfileItem[]; ctx: Ctx; quiet?: boolean }): React.JSX.Element {
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.text} className="py-3">
          <h3 className={quiet ? "font-serif text-base text-ink" : "text-sm font-semibold text-ink"}>{it.text}</h3>
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
