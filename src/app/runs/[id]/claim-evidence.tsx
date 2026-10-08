/**
 * "Show evidence" disclosure under one brief claim (idea #5 "Evidence on click").
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/claim-evidence.tsx
 * Deps:    react, src/domain/claim (type), ../../ui (Radar primitives), ./evidence, ./state (host, isCvSource)
 * Tested:  src/app/runs/[id]/__tests__/sections.test.ts (rendered through ClaimList)
 *
 * Key responsibilities:
 * - The verbatim quote ("Quote from the source"; STATEMENT: "Said by the candidate, not public evidence"), or the
 *   inference note when the claim has no quote
 * - Per supporting source: "Open at the quote" deep link (quoteLink), host, retrieval date, "Confirmed: <reason>",
 *   and the saved text around the quote with the match marked, plus until when that copy is kept
 *
 * Design constraints:
 * - Native <details>, no hooks (server-safe); Radar semantic tokens only; long URLs and quotes wrap at phone width
 * - Words rate the evidence, never the candidate
 */
import type { Claim } from "@/domain/claim";
import { Chevron, SUMMARY, SourceLink } from "../../ui";
import { type Evidence, contextKey, keptUntilLabel, quoteLink, retrievedLabel } from "./evidence";
import { host, isCvSource } from "./state";

const NOTE = "text-xs text-muted";

function SourceEvidence({ claim, sid, evidence }: { claim: Claim; sid: string; evidence: Evidence }): React.JSX.Element {
  const info = evidence.sourceOf.get(sid);
  if (info === undefined) return <li className={NOTE}>Source missing</li>;
  const link = quoteLink(info.url, claim.quote);
  const ctx = claim.quote === null ? undefined : evidence.contextOf.get(contextKey(claim.id, sid));
  const kept = keptUntilLabel(info.expires_at);
  const reason = typeof info.identity_reason === "string" && info.identity_reason !== "" ? info.identity_reason : null;
  return (
    <li className="flex flex-col gap-1">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <SourceLink url={link} label={isCvSource(info.url) ? undefined : link === info.url ? "Open the source" : "Open at the quote"} />
        {!isCvSource(info.url) && <span className={NOTE}>{host(info.url)}</span>}
      </span>
      <span className={NOTE}>{retrievedLabel(info.fetched_at)}</span>
      {reason !== null && <span className={NOTE}>Confirmed: {reason}</span>}
      {ctx !== undefined && (
        <figure className="mt-1">
          <figcaption className={NOTE}>Saved copy when retrieved{kept === null ? "" : ` (kept until ${kept})`}</figcaption>
          <p className="mt-1 rounded-lg border border-divider bg-surface px-3 py-2 text-xs text-ink">
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
  return (
    <details className={`group ${className}`}>
      <summary className={SUMMARY}>
        <Chevron />
        Show evidence
      </summary>
      <div className="flex flex-col gap-3 rounded-xl border border-divider bg-canvas p-3 [overflow-wrap:anywhere]">
        {quote !== null ? (
          <figure>
            <figcaption className="text-xs font-semibold text-muted">{claim.kind === "STATEMENT" ? "Said by the candidate, not public evidence" : "Quote from the source"}</figcaption>
            <blockquote className="mt-1 border-l-2 border-action/40 pl-3 font-serif text-ink">“{quote}”</blockquote>
          </figure>
        ) : (
          <p className={NOTE}>Inference: no direct quote, drawn from these sources</p>
        )}
        {sources.length === 0 ? (
          <p className={NOTE}>No source recorded</p>
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
