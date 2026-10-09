/**
 * "Confidence in this brief" card (plans/014): one ledger of labelled rows: Evidence (the verified share as a figure with a
 * three-part bar and legend), Identity (a state pill, counts, what the match rests on) and one row per check the run made,
 * each with what it leaves for the reader.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/trust-box-card.tsx
 * Deps:    react, ./trust-box (TrustBox, labels, notes), ./state (host), src/domain/url (httpUrl), ../../ui (CARD, Chevron, Eyebrow, KEY, LINK, Pill, SUMMARY_COMPACT)
 * Tested:  src/app/runs/[id]/__tests__/trust-box-card.test.ts
 *
 * Key responsibilities:
 * - TrustBoxCard: nothing for null; every strip is a row of the same grid (label column, content column) so the three parts read
 *   as one object; the figure ("78%" with "of the findings in this brief are verified facts", or "—" with the reason), the bar
 *   split facts / inferences / statements with a legend, the sources and devil's advocate lines, the meaning of "verified";
 *   the identity pill (ok / unsure / neutral), counts and "Matched on"; check rows with a "N to check" / "N to ask" pill, the
 *   sentence, the Ask / Check line and up to LINKS_VISIBLE links (the rest behind "Show all"); the fixed honesty note
 *
 * Design constraints:
 * - No hooks, English only (wrapped in lang="en" inside a Czech brief by the caller); Radar tokens only; the evidence-state colours
 *   (ok, inference) mark claim kinds, muted marks call statements, the identity pill marks the match state, never the person;
 *   the figure is one step smaller than the scorecard's so the role fit stays the page's one hero number
 * - `.profile` pf-* / tb-* classes animate once (figure fades, bar segments grow one after another, legend fades, rows rise)
 * - Words rate the research, never the candidate
 */
import { httpUrl } from "@/domain/url";
import { CARD, Chevron, Eyebrow, KEY, LINK, Pill, SUMMARY_COMPACT, type Tone } from "../../ui";
import { host } from "./state";
import { type CheckRow, type EvidenceStrip, type IdentityStrip, TRUST_BOX_NOTE, type TrustBox, VERIFIED_MEANS, sourcesLabel } from "./trust-box";

const NOTE = "text-xs text-muted";
/** Links per row before the rest folds behind "Show all". */
export const LINKS_VISIBLE = 4;

const ROW = "tb-row grid gap-x-6 gap-y-1.5 py-4 md:grid-cols-[12rem_minmax(0,1fr)]";

const IDENTITY_TONE: Record<IdentityStrip["status"], Tone> = { confirmed: "ok", open: "unsure", none: "neutral" };

/** What an open count on a row means: records to check by hand, differences or signals to ask about. */
const OPEN_WORD: Partial<Record<CheckRow["id"], string>> = { registries: "to check", cv: "to ask", accounts: "to ask" };

type Segment = { key: "facts" | "inferences" | "statements"; label: string; tone: string };
const SEGMENTS: readonly Segment[] = [
  { key: "facts", label: "Verified facts", tone: "bg-ok" },
  { key: "inferences", label: "Inferences", tone: "bg-inference" },
  { key: "statements", label: "Said in a call", tone: "bg-line" },
];

function Bar({ e }: { e: EvidenceStrip }): React.JSX.Element | null {
  const total = e.facts + e.inferences + e.statements;
  const shown = SEGMENTS.filter((s) => e[s.key] > 0);
  if (total === 0) return null;
  return (
    <div>
      <span aria-hidden="true" className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-divider print:[print-color-adjust:exact]">
        {shown.map((s) => (
          <span key={s.key} className={`pf-bar tb-seg block h-full ${s.tone}`} style={{ width: `${String((e[s.key] / total) * 100)}%` }} />
        ))}
      </span>
      <ul className={`tb-legend mt-2 flex flex-wrap gap-x-4 gap-y-1 ${NOTE}`} aria-label="Finding kinds">
        {shown.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block size-2 rounded-full ${s.tone} print:[print-color-adjust:exact]`} />
            <span>
              {s.label} <span className="font-semibold text-ink tabular-nums">{String(e[s.key])}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "52 percent of the findings in this brief are verified facts" for the figure; the reason when there is none. */
function figureLabel(e: EvidenceStrip): string {
  return e.pct === null ? (e.unavailable ?? "No verified share to show") : `${String(e.pct)} percent of the findings in this brief are verified facts`;
}

function Evidence({ e }: { e: EvidenceStrip }): React.JSX.Element {
  return (
    <li className={ROW}>
      <p className={KEY}>Evidence</p>
      <div className="pf-verdict min-w-0">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4">
          <p className="font-serif text-4xl leading-none text-ink tabular-nums" aria-label={figureLabel(e)}>
            {e.pct === null ? "—" : `${String(e.pct)}%`}
          </p>
          <p className="pb-0.5 text-sm text-ink" aria-hidden="true">
            {e.pct === null ? (
              <span className="text-muted">{e.unavailable}</span>
            ) : (
              <>
                <span className="text-muted">of the findings in this brief are </span>verified facts
              </>
            )}
          </p>
        </div>
        <div className="mt-3">
          <Bar e={e} />
        </div>
        <p className={`mt-3 ${NOTE}`}>
          {sourcesLabel(e.sources)}
          {e.challenge !== null && <span className="block">{e.challenge}</span>}
        </p>
        <p className={`mt-1.5 ${NOTE}`}>{VERIFIED_MEANS}</p>
      </div>
    </li>
  );
}

function Identity({ i }: { i: IdentityStrip }): React.JSX.Element {
  return (
    <li className={ROW}>
      <p className={KEY}>Identity</p>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Pill tone={IDENTITY_TONE[i.status]}>{i.label}</Pill>
          {i.supplied && <span className={NOTE}>from the profile link you supplied</span>}
        </p>
        <p className="mt-1.5 text-sm text-ink">{i.counts}</p>
        {i.reasons.length > 0 && <p className={`mt-1 ${NOTE}`}>Matched on {i.reasons.join("; ")}.</p>}
      </div>
    </li>
  );
}

type SafeLink = { key: string; u: string; h: string };

function Link({ l }: { l: SafeLink }): React.JSX.Element {
  return (
    <a href={l.h} target="_blank" rel="noreferrer" className={`${LINK} inline-block py-1`}>
      {host(l.u)}
    </a>
  );
}

function Links({ urls }: { urls: string[] }): React.JSX.Element | null {
  const safe: SafeLink[] = urls.flatMap((u, k) => {
    const h = httpUrl(u);
    return h === null ? [] : [{ key: `${String(k)}:${u}`, u, h }];
  });
  if (safe.length === 0) return null;
  const head = safe.slice(0, LINKS_VISIBLE);
  const rest = safe.slice(LINKS_VISIBLE);
  return (
    <div className="mt-1 text-xs">
      <span className="flex flex-wrap gap-x-3">
        {head.map((l) => (
          <Link key={l.key} l={l} />
        ))}
      </span>
      {rest.length > 0 && (
        <details className="group">
          <summary className={SUMMARY_COMPACT}>
            <Chevron />
            <span>{`Show all (${String(rest.length)} more)`}</span>
          </summary>
          <span className="flex flex-wrap gap-x-3">
            {rest.map((l) => (
              <Link key={l.key} l={l} />
            ))}
          </span>
        </details>
      )}
    </div>
  );
}

function Check({ row }: { row: CheckRow }): React.JSX.Element {
  const word = OPEN_WORD[row.id];
  return (
    <li className={ROW}>
      <p className={KEY}>{row.label}</p>
      <div className="min-w-0">
        {row.open > 0 && word !== undefined && (
          <Pill tone="neutral" className="mb-1.5">
            {`${String(row.open)} ${word}`}
          </Pill>
        )}
        <p className="text-sm text-ink">{row.text}</p>
        {row.ask !== null && <p className={`mt-1 ${NOTE}`}>{row.ask}</p>}
        <Links urls={row.urls} />
      </div>
    </li>
  );
}

export function TrustBoxCard({ box }: { box: TrustBox | null }): React.JSX.Element | null {
  if (box === null) return null;
  return (
    <section className={`profile ${CARD}`} aria-labelledby="trust-box">
      <Eyebrow>Evidence, identity, checks</Eyebrow>
      <h2 id="trust-box" className="mt-1 font-serif text-2xl">
        Confidence in this brief
      </h2>
      <ul className="tb-rows mt-3 divide-y divide-divider border-y border-divider">
        <Evidence e={box.evidence} />
        <Identity i={box.identity} />
        {box.checks.map((row) => (
          <Check key={row.id} row={row} />
        ))}
      </ul>
      <p className={`mt-3 ${NOTE}`}>{TRUST_BOX_NOTE}</p>
    </section>
  );
}
