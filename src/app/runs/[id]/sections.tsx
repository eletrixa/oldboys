/**
 * Brief findings by section: title, confidence badge, reason line, sourced claims (FACT vs INFERENCE) and summary.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/sections.tsx
 * Deps:    react, src/domain/claim (types), ./state
 * Tested:  n/a (ordering and bands are tested in __tests__/state.test.ts)
 *
 * Key responsibilities:
 * - SectionList: sections in the order given (BriefView passes them confidence descending)
 * - ClaimList: one claim per row with its kind tag and source links; also used for the per-question fallback
 * - Source-only sections (social presence, platforms without claims) list their confirmed source links
 *
 * Design constraints:
 * - Pure rendering; the confidence rates the research behind a section, never the person
 */
import type { BriefSection, Claim } from "@/domain/claim";
import { type ConfidenceBand, confidenceBand, host } from "./state";

const CARD = "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5";

const BAND: Record<ConfidenceBand, string> = {
  strong: "bg-ok-bg text-ok",
  fair: "bg-amber-500/15 text-amber-300",
  weak: "bg-zinc-800 text-zinc-400",
};

function SourceLink({ url }: { url: string }): React.JSX.Element {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="ml-2 text-teal-400 underline">
      {host(url)}
    </a>
  );
}

export function ClaimList({ claims, urlOf }: { claims: Claim[]; urlOf: ReadonlyMap<string, string> }): React.JSX.Element | null {
  if (claims.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {claims.map((c) => (
        <li key={c.id} className="text-sm">
          <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.kind === "INFERENCE" ? "bg-violet-500/15 text-violet-300" : "bg-zinc-800 text-zinc-300"}`}>
            {c.kind}
          </span>
          {c.text}
          {c.supports.map((sid) => {
            const url = urlOf.get(sid);
            return url !== undefined ? (
              <SourceLink key={sid} url={url} />
            ) : (
              <span key={sid} className="ml-2 text-xs text-zinc-500">
                source missing
              </span>
            );
          })}
        </li>
      ))}
    </ul>
  );
}

function SectionCard({ section, claims, urlOf }: { section: BriefSection; claims: Claim[]; urlOf: ReadonlyMap<string, string> }): React.JSX.Element {
  const band = confidenceBand(section.confidence);
  const facts = claims.filter((c) => c.kind !== "INFERENCE");
  const inferences = claims.filter((c) => c.kind === "INFERENCE");
  const links = claims.length === 0 ? [...new Set(section.source_ids.flatMap((sid) => urlOf.get(sid) ?? []))] : [];
  return (
    <section className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{section.title}</h3>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${BAND[band]}`}>
          {String(Math.round(section.confidence * 100))}% {band}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{section.confidence_reason}</p>
      {section.summary !== "" && <p className="mt-2 text-sm text-zinc-300">{section.summary}</p>}
      <ClaimList claims={facts} urlOf={urlOf} />
      <ClaimList claims={inferences} urlOf={urlOf} />
      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {links.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="text-teal-400 underline">
                {url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SectionList({ sections, claims, urlOf }: { sections: BriefSection[]; claims: Claim[]; urlOf: ReadonlyMap<string, string> }): React.JSX.Element {
  return (
    <>
      {sections.map((s) => (
        <SectionCard key={s.id} section={s} claims={claims.filter((c) => s.claim_ids.includes(c.id))} urlOf={urlOf} />
      ))}
    </>
  );
}
