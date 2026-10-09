/**
 * Brief findings by section: title, confidence badge, reason line, sourced claims (FACT vs INFERENCE) and summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/sections.tsx
 * Deps:    react, src/domain/claim (types), src/domain/cv-check (type), ./state, ./evidence, ./claim-evidence, ./cv-check, ./report-lang (useReport), ./report-text (tid), ../../ui (Radar primitives)
 * Tested:  the claim evidence rendering (English and Czech) in __tests__/sections.test.ts; CV outcome pills in __tests__/cv-check.test.ts; isShown, ordering and bands in __tests__/state.test.ts / sections.test.ts
 *
 * Key responsibilities:
 * - SectionList: sections in the order given (BriefView passes them confidence descending)
 * - SectionRows: the same sections as compact disclosures in one card (title, one-line summary, confidence pill, claim
 *   count); inside, claims show a short quote inline instead of the "Show evidence" toggle (finished brief, Evidence tab)
 * - ClaimList: one claim per row (grid: kind tag cell, text cell, so wrapped text hangs beside the tag) with its kind tag, a "Conflicts with another claim" pill when claim.contradicts is
 *   non-empty, and source links that open the page at the quote (quoteLink; tooltip = "Confirmed: <identity_reason>"
 *   and the retrieval date); also used for the per-question fallback
 * - Under each claim a "Show evidence" disclosure (ClaimEvidence, idea #5): quote, sources, retrieval dates, saved copy
 * - A claim the devil's advocate challenged (idea #8) gets a muted "Challenged: … — ask at the interview" line
 * - Source-only sections (platforms without claims) list their confirmed source links; empty ones are not rendered;
 *   social presence also lists its profile links that no claim cites
 * - SourceLink: the pasted CV renders as "Candidate's CV (pasted)" with no href (its URL is "cv:<runId>")
 * - "CV vs public record" (idea #14): the explainer line and, per claim, an outcome pill above its text (Matches
 *   public record / Differs — ask, don't assume / Not found publicly), claims grouped in that order (./cv-check)
 * - Report language (idea #24): labels from the Report in context (useReport), model texts by id (tid) with the
 *   English text as fallback; quotes and URLs are never translated
 *
 * Design constraints:
 * - Pure rendering (only the report context is read); the confidence rates the research behind a section, never the person, and is shown in words only
 *   (Strong / Some / Thin evidence), never as a percentage
 */
import type { BriefSection, Claim } from "@/domain/claim";
import type { CvOutcome } from "@/domain/cv-check";
import { CARD, CARD_FLUSH, Chevron, Pill, SourceLink, type Tone } from "../../ui";
import { ClaimEvidence, originalLang } from "./claim-evidence";
import { CV_OUTCOME, cvRows, isCvSection } from "./cv-check";
import { type Evidence, quoteLink } from "./evidence";
import type { Report } from "./i18n";
import { useReport } from "./report-lang";
import { tid } from "./report-text";
import { type ConfidenceBand, confidenceBand, host, isShown } from "./state";

const BAND_TONE: Record<ConfidenceBand, Tone> = { strong: "ok", fair: "unsure", weak: "neutral" };

/** Tooltip of an inline source link: why the source is theirs, and when we read it. */
function linkTitle(report: Report, sid: string, reason: string | null | undefined, fetchedAt: string | null | undefined): string {
  const why = typeof reason === "string" && reason !== "" ? report.t.confirmedBecause(report.text(tid.sourceReason(sid), reason)) : null;
  return [why, report.t.retrieved(fetchedAt)].filter((t) => t !== null).join(" · ");
}

/** Quotes up to this length show inline in the compact rows, without a "Show evidence" toggle. */
export const INLINE_QUOTE_MAX = 200;

const inlineQuote = (c: Claim): boolean => c.quote !== null && c.quote.length <= INLINE_QUOTE_MAX;

/**
 * `outcomeOf`: the CV check outcome per claim id; only the "CV vs public record" section passes it.
 * `inline`: a short quote shows in the row and replaces the claim's "Show evidence" disclosure (compact section rows).
 */
export function ClaimList({ claims, evidence, outcomeOf, inline = false }: { claims: Claim[]; evidence: Evidence; outcomeOf?: ReadonlyMap<string, CvOutcome>; inline?: boolean }): React.JSX.Element | null {
  const report = useReport();
  if (claims.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {claims.map((c) => (
        <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 py-1.5 text-sm">
          <Pill tone={c.kind === "INFERENCE" ? "inference" : "neutral"} className="mt-0.5">
            {report.t.kind[c.kind]}
          </Pill>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            <CvOutcomePill outcome={outcomeOf?.get(c.id)} />
            {report.text(tid.claim(c.id), c.text)}
            {c.contradicts.length > 0 && (
              <Pill tone="conflict" className="ml-2">
                {report.t.conflicts}
              </Pill>
            )}
            <ChallengeNote claim={c} evidence={evidence} />
            {inline && inlineQuote(c) && (
              <span className="mt-1 block text-xs text-muted">
                <q lang={originalLang(report.lang)} className="italic">{c.quote}</q>
              </span>
            )}
            {c.supports.map((sid) => {
              const info = evidence.sourceOf.get(sid);
              return info !== undefined ? (
                <span key={sid} title={linkTitle(report, sid, info.identity_reason, info.fetched_at)}>
                  <SourceLink url={quoteLink(info.url, c.quote)} label={host(info.url)} className="ml-2" />
                </span>
              ) : (
                <span key={sid} className="ml-2 text-xs text-muted">
                  {report.t.sourceMissing}
                </span>
              );
            })}
          </span>
          {!(inline && inlineQuote(c)) && <ClaimEvidence claim={c} evidence={evidence} className="col-start-2" />}
        </li>
      ))}
    </ul>
  );
}

/** Devil's advocate (idea #8): a muted line saying why the finding moved to the interview. */
function ChallengeNote({ claim, evidence }: { claim: Claim; evidence: Evidence }): React.JSX.Element | null {
  const { t } = useReport();
  const ch = evidence.challengeOf.get(claim.id);
  if (ch === undefined) return null;
  return <span className="mt-0.5 block text-xs text-muted">{t.challengeTag(ch.ground)}</span>;
}

function CvOutcomePill({ outcome }: { outcome: CvOutcome | undefined }): React.JSX.Element | null {
  const { t } = useReport();
  if (outcome === undefined) return null;
  return (
    <span className="mb-1 block">
      <Pill tone={CV_OUTCOME[outcome].tone}>{t.cvOutcome[outcome]}</Pill>
    </span>
  );
}

/** The CV check's claims in outcome order with their pills, under the explainer line. */
function CvClaims({ claims, evidence, inline = false }: { claims: Claim[]; evidence: Evidence; inline?: boolean }): React.JSX.Element {
  const { t } = useReport();
  const rows = cvRows(claims, [...evidence.sourceOf].map(([id, info]) => ({ id, url: info.url })));
  return (
    <>
      <p className="mt-2 text-xs text-muted">{t.cvExplainer}</p>
      <ClaimList claims={rows.map((r) => r.claim)} evidence={evidence} outcomeOf={new Map(rows.map((r) => [r.claim.id, r.outcome]))} inline={inline} />
    </>
  );
}

function SectionCard({ section, claims, evidence }: { section: BriefSection; claims: Claim[]; evidence: Evidence }): React.JSX.Element {
  const report = useReport();
  const band = confidenceBand(section.confidence);
  const cv = isCvSection(section.id) && claims.length > 0;
  const facts = cv ? [] : claims.filter((c) => c.kind !== "INFERENCE");
  const inferences = cv ? [] : claims.filter((c) => c.kind === "INFERENCE");
  // Social presence always lists its profiles; other sections list links only when no claim carries them
  const cited = new Set(claims.flatMap((c) => c.supports));
  const listed = claims.length === 0 ? section.source_ids : section.id === "social-presence" ? section.source_ids.filter((sid) => !cited.has(sid)) : [];
  const links = [...new Set(listed.flatMap((sid) => evidence.sourceOf.get(sid)?.url ?? []))];
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-base font-semibold [overflow-wrap:anywhere]">{report.text(tid.sectionTitle(section.id), section.title)}</h3>
        <Pill tone={BAND_TONE[band]}>{report.t.band[band]}</Pill>
      </div>
      <p className="mt-1 text-xs text-muted">{report.text(tid.sectionReason(section.id), section.confidence_reason)}</p>
      {section.summary !== "" && <p className="mt-2 text-sm text-ink">{report.text(tid.sectionSummary(section.id), section.summary)}</p>}
      {cv && <CvClaims claims={claims} evidence={evidence} />}
      <ClaimList claims={facts} evidence={evidence} />
      <ClaimList claims={inferences} evidence={evidence} />
      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
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

/** The claims and links of one section (shared by the card and the compact row). */
function sectionParts(section: BriefSection, claims: Claim[], evidence: Evidence): { cv: boolean; facts: Claim[]; inferences: Claim[]; links: string[] } {
  const cv = isCvSection(section.id) && claims.length > 0;
  const cited = new Set(claims.flatMap((c) => c.supports));
  const listed = claims.length === 0 ? section.source_ids : section.id === "social-presence" ? section.source_ids.filter((sid) => !cited.has(sid)) : [];
  return {
    cv,
    facts: cv ? [] : claims.filter((c) => c.kind !== "INFERENCE"),
    inferences: cv ? [] : claims.filter((c) => c.kind === "INFERENCE"),
    links: [...new Set(listed.flatMap((sid) => evidence.sourceOf.get(sid)?.url ?? []))],
  };
}

/** One section as a compact disclosure: title, one-line summary, confidence pill and claim count; claims with inline quotes inside. */
function SectionRow({ section, claims, evidence }: { section: BriefSection; claims: Claim[]; evidence: Evidence }): React.JSX.Element {
  const report = useReport();
  const band = confidenceBand(section.confidence);
  const { cv, facts, inferences, links } = sectionParts(section, claims, evidence);
  const summary = section.summary !== "" ? report.text(tid.sectionSummary(section.id), section.summary) : report.text(tid.sectionReason(section.id), section.confidence_reason);
  return (
    <details className="group px-5 md:px-6">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="pt-1">
          <Chevron />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink [overflow-wrap:anywhere]">{report.text(tid.sectionTitle(section.id), section.title)}</span>
          <span className="block text-xs text-muted group-open:hidden md:truncate">{summary}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
          <Pill tone={BAND_TONE[band]}>{report.t.band[band]}</Pill>
          <span className="text-xs text-muted tabular-nums">{report.t.ui.claimsCount(claims.length)}</span>
        </span>
      </summary>
      <div className="pb-4 pl-5">
        <p className="text-xs text-muted">{report.text(tid.sectionReason(section.id), section.confidence_reason)}</p>
        {section.summary !== "" && <p className="mt-2 text-sm text-ink">{report.text(tid.sectionSummary(section.id), section.summary)}</p>}
        {cv && <CvClaims claims={claims} evidence={evidence} inline />}
        <ClaimList claims={facts} evidence={evidence} inline />
        <ClaimList claims={inferences} evidence={evidence} inline />
        {links.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-sm [overflow-wrap:anywhere]">
            {links.map((url) => (
              <li key={url}>
                <SourceLink url={url} label={url.replace(/^https?:\/\/(www\.)?/, "")} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/** Sections as compact rows in one flush card (Evidence tab of the finished brief). */
export function SectionRows({ sections, claims, evidence }: { sections: BriefSection[]; claims: Claim[]; evidence: Evidence }): React.JSX.Element | null {
  const { t } = useReport();
  const shown = sections.filter(isShown);
  if (shown.length === 0) return null;
  return (
    <section className={`${CARD_FLUSH} divide-y divide-divider`} aria-labelledby="findings-h">
      <h2 id="findings-h" className="px-5 pt-5 pb-3 font-serif text-xl md:px-6">{t.ui.findings}</h2>
      {shown.map((s) => (
        <SectionRow key={s.id} section={s} claims={claims.filter((c) => s.claim_ids.includes(c.id))} evidence={evidence} />
      ))}
    </section>
  );
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
