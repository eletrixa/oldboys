/**
 * Brief findings by section: title, confidence badge, reason line, sourced claims (FACT vs INFERENCE) and summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/sections.tsx
 * Deps:    react, src/domain/claim (types), ./state, ../../ui (Radar primitives)
 * Tested:  isShown in __tests__/sections.test.ts; ordering and bands in __tests__/state.test.ts
 *
 * Key responsibilities:
 * - SectionList: sections in the order given (BriefView passes them confidence descending)
 * - ClaimList: one claim per row (grid: kind tag cell, text cell, so wrapped text hangs beside the tag) with its kind tag, a "Conflicts with another claim" pill when claim.contradicts is
 *   non-empty, and source links (the "confirmed: <identity_reason>" note is the link's tooltip); also used for the
 *   per-question fallback
 * - Source-only sections (platforms without claims) list their confirmed source links; empty ones are not rendered
 * - SourceLink: the pasted CV renders as "Candidate's CV (pasted)" with no href (its URL is "cv:<runId>")
 *
 * Design constraints:
 * - Pure rendering; the confidence rates the research behind a section, never the person, and is shown in words only
 *   (Strong / Some / Thin evidence), never as a percentage
 */
import type { BriefSection, Claim } from "@/domain/claim";
import { CARD, Pill, SourceLink, type Tone } from "../../ui";
import { type ConfidenceBand, confidenceBand } from "./state";

const BAND: Record<ConfidenceBand, { tone: Tone; label: string }> = {
  strong: { tone: "ok", label: "Strong evidence" },
  fair: { tone: "unsure", label: "Some evidence" },
  weak: { tone: "neutral", label: "Thin evidence" },
};

const KIND_LABEL: Record<Claim["kind"], string> = { FACT: "Fact", INFERENCE: "Inference", STATEMENT: "Statement" };

/** source id -> why it was confirmed beyond its profile link (sources.identity_reason). */
type NoteOf = ReadonlyMap<string, string>;

export function ClaimList({ claims, urlOf, noteOf }: { claims: Claim[]; urlOf: ReadonlyMap<string, string>; noteOf?: NoteOf }): React.JSX.Element | null {
  if (claims.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {claims.map((c) => (
        <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 py-1.5 text-sm">
          <Pill tone={c.kind === "INFERENCE" ? "inference" : "neutral"} className="mt-0.5">
            {KIND_LABEL[c.kind]}
          </Pill>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {c.text}
            {c.contradicts.length > 0 && (
              <Pill tone="conflict" className="ml-2">
                Conflicts with another claim
              </Pill>
            )}
            {c.supports.map((sid) => {
              const url = urlOf.get(sid);
              const note = noteOf?.get(sid);
              return url !== undefined ? (
                <span key={sid} title={note === undefined ? undefined : `Confirmed: ${note}`}>
                  <SourceLink url={url} className="ml-2" />
                </span>
              ) : (
                <span key={sid} className="ml-2 text-xs text-muted">
                  source missing
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SectionCard({ section, claims, urlOf, noteOf }: { section: BriefSection; claims: Claim[]; urlOf: ReadonlyMap<string, string>; noteOf?: NoteOf }): React.JSX.Element {
  const band = confidenceBand(section.confidence);
  const facts = claims.filter((c) => c.kind !== "INFERENCE");
  const inferences = claims.filter((c) => c.kind === "INFERENCE");
  const links = claims.length === 0 ? [...new Set(section.source_ids.flatMap((sid) => urlOf.get(sid) ?? []))] : [];
  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{section.title}</h3>
        <Pill tone={BAND[band].tone}>{BAND[band].label}</Pill>
      </div>
      <p className="mt-1 text-xs text-muted">{section.confidence_reason}</p>
      {section.summary !== "" && <p className="mt-2 text-sm text-ink">{section.summary}</p>}
      <ClaimList claims={facts} urlOf={urlOf} noteOf={noteOf} />
      <ClaimList claims={inferences} urlOf={urlOf} noteOf={noteOf} />
      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {links.map((url) => (
            <li key={url}>
              <SourceLink url={url} label={url.replace(/^https?:\/\/(www\.)?/, "")} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A section with no claims and no sources has nothing to show; neither has a claimless social-presence list. */
export function isShown(s: BriefSection): boolean {
  return s.claim_ids.length > 0 || (s.source_ids.length > 0 && s.id !== "social-presence");
}

export function SectionList({ sections, claims, urlOf, noteOf }: { sections: BriefSection[]; claims: Claim[]; urlOf: ReadonlyMap<string, string>; noteOf?: NoteOf }): React.JSX.Element {
  return (
    <>
      {sections.filter(isShown).map((s) => (
        <SectionCard key={s.id} section={s} claims={claims.filter((c) => s.claim_ids.includes(c.id))} urlOf={urlOf} noteOf={noteOf} />
      ))}
    </>
  );
}
