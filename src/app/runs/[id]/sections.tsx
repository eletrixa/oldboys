/**
 * Brief findings by section: title, confidence badge, reason line, sourced claims (FACT vs INFERENCE) and summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/sections.tsx
 * Deps:    react, src/domain/claim (types), ./state, ./evidence, ./claim-evidence, ../../ui (Radar primitives)
 * Tested:  isShown and the claim evidence rendering in __tests__/sections.test.ts; ordering and bands in __tests__/state.test.ts
 *
 * Key responsibilities:
 * - SectionList: sections in the order given (BriefView passes them confidence descending)
 * - ClaimList: one claim per row (grid: kind tag cell, text cell, so wrapped text hangs beside the tag) with its kind tag, a "Conflicts with another claim" pill when claim.contradicts is
 *   non-empty, and source links that open the page at the quote (quoteLink; tooltip = "Confirmed: <identity_reason>"
 *   and the retrieval date); also used for the per-question fallback
 * - Under each claim a "Show evidence" disclosure (ClaimEvidence, idea #5): quote, sources, retrieval dates, saved copy
 * - Source-only sections (platforms without claims) list their confirmed source links; empty ones are not rendered;
 *   social presence also lists its profile links that no claim cites
 * - SourceLink: the pasted CV renders as "Candidate's CV (pasted)" with no href (its URL is "cv:<runId>")
 *
 * Design constraints:
 * - Pure rendering; the confidence rates the research behind a section, never the person, and is shown in words only
 *   (Strong / Some / Thin evidence), never as a percentage
 */
import type { BriefSection, Claim } from "@/domain/claim";
import { CARD, Pill, SourceLink, type Tone } from "../../ui";
import { ClaimEvidence } from "./claim-evidence";
import { type Evidence, quoteLink, retrievedLabel } from "./evidence";
import { type ConfidenceBand, confidenceBand, host } from "./state";

const BAND: Record<ConfidenceBand, { tone: Tone; label: string }> = {
  strong: { tone: "ok", label: "Strong evidence" },
  fair: { tone: "unsure", label: "Some evidence" },
  weak: { tone: "neutral", label: "Thin evidence" },
};

const KIND_LABEL: Record<Claim["kind"], string> = { FACT: "Fact", INFERENCE: "Inference", STATEMENT: "Statement" };

/** Tooltip of an inline source link: why the source is theirs, and when we read it. */
function linkTitle(reason: string | null | undefined, fetchedAt: string | null | undefined): string {
  return [typeof reason === "string" && reason !== "" ? `Confirmed: ${reason}` : null, retrievedLabel(fetchedAt)].filter((t) => t !== null).join(" · ");
}

export function ClaimList({ claims, evidence }: { claims: Claim[]; evidence: Evidence }): React.JSX.Element | null {
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
              const info = evidence.sourceOf.get(sid);
              return info !== undefined ? (
                <span key={sid} title={linkTitle(info.identity_reason, info.fetched_at)}>
                  <SourceLink url={quoteLink(info.url, c.quote)} label={host(info.url)} className="ml-2" />
                </span>
              ) : (
                <span key={sid} className="ml-2 text-xs text-muted">
                  source missing
                </span>
              );
            })}
          </span>
          <ClaimEvidence claim={c} evidence={evidence} className="col-start-2" />
        </li>
      ))}
    </ul>
  );
}

function SectionCard({ section, claims, evidence }: { section: BriefSection; claims: Claim[]; evidence: Evidence }): React.JSX.Element {
  const band = confidenceBand(section.confidence);
  const facts = claims.filter((c) => c.kind !== "INFERENCE");
  const inferences = claims.filter((c) => c.kind === "INFERENCE");
  // Social presence always lists its profiles; other sections list links only when no claim carries them
  const cited = new Set(claims.flatMap((c) => c.supports));
  const listed = claims.length === 0 ? section.source_ids : section.id === "social-presence" ? section.source_ids.filter((sid) => !cited.has(sid)) : [];
  const links = [...new Set(listed.flatMap((sid) => evidence.sourceOf.get(sid)?.url ?? []))];
  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{section.title}</h3>
        <Pill tone={BAND[band].tone}>{BAND[band].label}</Pill>
      </div>
      <p className="mt-1 text-xs text-muted">{section.confidence_reason}</p>
      {section.summary !== "" && <p className="mt-2 text-sm text-ink">{section.summary}</p>}
      <ClaimList claims={facts} evidence={evidence} />
      <ClaimList claims={inferences} evidence={evidence} />
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

/** A section with no claims and no sources has nothing to show; a claimless social-presence section lists the profiles. */
export function isShown(s: BriefSection): boolean {
  return s.claim_ids.length > 0 || s.source_ids.length > 0;
}

export function SectionList({ sections, claims, evidence }: { sections: BriefSection[]; claims: Claim[]; evidence: Evidence }): React.JSX.Element {
  return (
    <>
      {sections.filter(isShown).map((s) => (
        <SectionCard key={s.id} section={s} claims={claims.filter((c) => s.claim_ids.includes(c.id))} evidence={evidence} />
      ))}
    </>
  );
}
