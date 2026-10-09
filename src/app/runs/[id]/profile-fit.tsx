/**
 * Position fit of the candidate profile: bar per role, weighted capability table, formula behind a disclosure.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-fit.tsx
 * Deps:    react, src/domain/claim (types), ../../ui, ./evidence-line, ./profile-evidence
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Fit % = Σ(weight × status) ÷ Σ(weight), computed here; neutral bar, never a colour scale
 * - Table stacks under 640px; each capability's evidence sits in a full-width row below it; explicit table / rowgroup /
 *   row / rowheader / cell roles keep the table semantics when the display changes
 */
import type { PositionFit } from "@/domain/claim";
import { CARD, Chevron, Pill, SUMMARY_COMPACT, type Tone } from "../../ui";
import { type Ctx, MEASURE, NOTE } from "./evidence-line";
import { Dropped, EvidenceList, FIGURE, Head, INTRO } from "./profile-evidence";

import { fitPct } from "./scorecard";

export { fitPct };

const STATUS: Record<"has" | "partial" | "none", { text: string; tone: Tone }> = {
  has: { text: "Has", tone: "ok" },
  partial: { text: "Partial", tone: "unsure" },
  none: { text: "No evidence", tone: "neutral" },
};

export const evidenced = (f: PositionFit): string =>
  `${String(f.traits.filter((t) => t.status === "has").length)} of ${String(f.traits.length)} must-haves evidenced`;

/** Thin neutral bar; never a colour scale. */
export function Bar({ pct }: { pct: number }): React.JSX.Element {
  return (
    <span aria-hidden="true" className="block h-1 w-full overflow-hidden rounded-full bg-divider">
      <span className="pf-bar block h-full rounded-full bg-muted" style={{ width: `${String(Math.min(100, Math.max(0, pct)))}%` }} />
    </span>
  );
}

/** The run's role first (matched by name, else the first card), then the adjacent roles. */
export function orderFits(fits: PositionFit[], role: string | null): PositionFit[] {
  const want = role?.trim().toLowerCase();
  const i = Math.max(0, fits.findIndex((f) => f.role.trim().toLowerCase() === want));
  const main = fits[i];
  return main === undefined ? [] : [main, ...fits.filter((_, j) => j !== i)];
}

export function Fit({ fits, dropped, ctx }: { fits: PositionFit[]; dropped: number; ctx: Ctx }): React.JSX.Element {
  const [main] = fits;
  const rows = [...new Set(fits.flatMap((f) => f.traits.map((t) => t.trait)))].map((name) => ({
    name,
    per: fits.map((f) => f.traits.find((t) => t.trait === name)),
  }));
  return (
    <section className={CARD}>
      <Head id="fit" eyebrow="Evidence coverage" title="5. Position fit" />
      <p className={INTRO}>Share of the role profile with public evidence, not a performance prediction.</p>
      <ul className="mt-4 space-y-4">
        {fits.map((f) => (
          <li key={f.role} className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-4">
            <span className={FIGURE}>{String(fitPct(f))}%</span>
            <span className="text-sm">
              <span className={f === main ? "font-semibold text-ink" : "text-muted"}>{f.role}</span>
              <span className="mt-2 mb-1 block">
                <Bar pct={fitPct(f)} />
              </span>
              <span className={NOTE}>{evidenced(f)}</span>
            </span>
          </li>
        ))}
      </ul>
      <details className="group mt-2">
        <summary className={SUMMARY_COMPACT}>
          <Chevron />
          How the % is computed
        </summary>
        <p className={`mb-2 ${NOTE}`}>
          Weight runs from 0 (not needed) to 3 (critical); Has counts 1, Partial 0.5, No evidence 0; fit = Σ(weight × status) ÷ Σ(weight).
        </p>
      </details>
      {/* From sm up a table (scrolls sideways past three roles); under 640px each capability stacks: name, status and
          labelled weights, then its evidence. Evidence sits in its own full-width row below the capability, never in a cell. */}
      <div className="mt-4 sm:overflow-x-auto">
        <table role="table" className={`w-full border-collapse text-left text-sm max-sm:block ${fits.length > 1 ? "sm:min-w-[32rem]" : ""}`}>
          <thead role="rowgroup" className={`${NOTE} max-sm:sr-only`}>
            <tr role="row" className="border-b border-divider">
              <th scope="col" role="columnheader" className="py-2 pr-4 font-semibold">
                Capability
              </th>
              <th scope="col" role="columnheader" className="py-2 pr-4 font-semibold">
                Evidence
              </th>
              {fits.map((f) => (
                <th key={f.role} scope="col" role="columnheader" className="py-2 text-right font-semibold">
                  {fits.length > 1 ? f.role : "Weight"}
                  {fits.length > 1 && <span className="block font-normal">weight</span>}
                </th>
              ))}
            </tr>
          </thead>
          {rows.map(({ name, per }) => {
            const t = per.find((x) => x !== undefined);
            return (
              <tbody key={name} role="rowgroup" className="border-t border-divider max-sm:block max-sm:py-2 max-sm:first-of-type:border-t-0">
                <tr role="row" className="align-top max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-1">
                  <th scope="row" role="rowheader" className="py-2 pr-4 font-normal text-ink max-sm:w-full max-sm:p-0">
                    {name}
                  </th>
                  <td role="cell" className="py-2 pr-4 max-sm:p-0">{t !== undefined && <Pill tone={STATUS[t.status].tone} className="whitespace-nowrap">{STATUS[t.status].text}</Pill>}</td>
                  {per.map((x, i) => (
                    <td key={fits[i]?.role ?? i} role="cell" className="py-2 text-right text-muted tabular-nums max-sm:p-0 max-sm:text-xs">
                      <span className="sm:hidden">{fits.length > 1 ? `${fits[i]?.role ?? ""} weight ` : "weight "}</span>
                      {x === undefined ? "–" : String(x.weight)}
                    </td>
                  ))}
                </tr>
                {t !== undefined && t.evidence.length > 0 && (
                  <tr role="row" className="max-sm:block">
                    <td colSpan={2 + fits.length} role="cell" className="pb-2 max-sm:block max-sm:p-0">
                      <EvidenceList items={t.evidence} ctx={ctx} about={name} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
      {main !== undefined && main.rationale !== "" && <p className={`mt-4 ${MEASURE} ${NOTE}`}>{main.rationale}</p>}
      <Dropped n={dropped} />
    </section>
  );
}
