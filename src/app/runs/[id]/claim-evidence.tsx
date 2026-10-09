/**
 * "Show evidence" disclosure under one brief claim (idea #5 "Evidence on click").
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/claim-evidence.tsx
 * Deps:    react, src/domain/claim (type), ../../ui (Radar primitives), ./evidence, ./report-lang (useReport), ./report-text (tid), ./state (host, isCvSource)
 * Tested:  src/app/runs/[id]/__tests__/sections.test.ts (rendered through ClaimList)
 *
 * Key responsibilities:
 * - Devil's advocate (idea #8): a challenged claim opens with "Challenged: … — ask at the interview." and the
 *   source-level reason
 * - The verbatim quote ("Quote from the source"; STATEMENT: "Said by the candidate, not public evidence"), or the
 *   inference note when the claim has no quote
 * - Per supporting source: "Open at the quote" deep link (quoteLink), host, retrieval date, "Confirmed: <reason>",
 *   and the saved text around the quote with the match marked, plus until when that copy is kept
 *
 * - Report language (idea #24): labels from the report context, the challenge reason and the confirmation reason
 *   translated by id; the quote and the saved copy stay in the original language ("Citace v originále"), marked lang=""
 *   (unknown) inside a Czech brief
 *
 * Design constraints:
 * - Native <details>; the only hook reads the report context; Radar semantic tokens only; long URLs and quotes wrap at phone width
 * - Words rate the evidence, never the candidate
 */
import type { Claim } from "@/domain/claim";
import { Chevron, SUMMARY, SourceLink } from "../../ui";
import { type Evidence, contextKey, quoteLink } from "./evidence";
import { useReport } from "./report-lang";
import { tid } from "./report-text";
import { host, isCvSource } from "./state";

const NOTE = "text-xs text-muted";

/** Quotes keep their original language: inside a Czech brief they are marked as unknown (lang=""), not Czech. */
export function originalLang(lang: string): string | undefined {
  return lang === "en" ? undefined : "";
}

function SourceEvidence({ claim, sid, evidence }: { claim: Claim; sid: string; evidence: Evidence }): React.JSX.Element {
  const { t, text, lang } = useReport();
  const info = evidence.sourceOf.get(sid);
  if (info === undefined) return <li className={NOTE}>{t.sourceMissingRow}</li>;
  const link = quoteLink(info.url, claim.quote);
  const ctx = claim.quote === null ? undefined : evidence.contextOf.get(contextKey(claim.id, sid));
  const reason = typeof info.identity_reason === "string" && info.identity_reason !== "" ? text(tid.sourceReason(sid), info.identity_reason) : null;
  return (
    <li className="flex flex-col gap-1">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <SourceLink url={link} label={isCvSource(info.url) ? undefined : link === info.url ? t.openSource : t.openAtQuote} />
        {!isCvSource(info.url) && <span className={NOTE}>{host(info.url)}</span>}
      </span>
      <span className={NOTE}>{t.retrieved(info.fetched_at)}</span>
      {reason !== null && <span className={NOTE}>{t.confirmedBecause(reason)}</span>}
      {ctx !== undefined && (
        <figure className="mt-1">
          <figcaption className={NOTE}>{t.savedCopy(info.expires_at)}</figcaption>
          <p lang={originalLang(lang)} className="mt-1 rounded-lg border border-divider bg-surface px-3 py-2 text-xs text-ink">
            {ctx.before}
            <mark className="rounded bg-peach px-0.5 text-ink">{ctx.match}</mark>
            {ctx.after}
          </p>
        </figure>
      )}
    </li>
  );
}

export function ClaimEvidence({ claim, evidence, className = "" }: { claim: Claim; evidence: Evidence; className?: string }): React.JSX.Element {
  const quote = claim.quote !== null && claim.quote.trim() !== "" ? claim.quote.trim() : null;
  const sources = [...new Set(claim.supports)];
  const challenge = evidence.challengeOf.get(claim.id);
  const { t, text, lang } = useReport();
  return (
    <details className={`group ${className}`}>
      <summary className={SUMMARY}>
        <Chevron />
        {t.showEvidence}
      </summary>
      <div className="flex flex-col gap-3 rounded-xl border border-divider bg-canvas p-3 [overflow-wrap:anywhere]">
        {challenge !== undefined && (
          <p className="text-xs text-muted">
            <span className="font-semibold">{t.challengeTag(challenge.ground)}.</span> {text(tid.challenge(claim.id), challenge.why)}
          </p>
        )}
        {quote !== null ? (
          <figure>
            <figcaption className="text-xs font-semibold text-muted">{claim.kind === "STATEMENT" ? t.saidOnCall : t.quoteFromSource}</figcaption>
            <blockquote lang={originalLang(lang)} className="mt-1 border-l-2 border-action/40 pl-3 font-serif text-ink">“{quote}”</blockquote>
          </figure>
        ) : (
          <p className={NOTE}>{t.inferenceNote}</p>
        )}
        {sources.length === 0 ? (
          <p className={NOTE}>{t.noSource}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sources.map((sid) => (
              <SourceEvidence key={sid} claim={claim} sid={sid} evidence={evidence} />
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
