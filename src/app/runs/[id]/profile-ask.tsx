/**
 * Interview questions and the numbered Sources list of the candidate profile.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-ask.tsx
 * Deps:    react, src/domain/claim (types), ../../ui, ./profile-evidence, ./evidence, ./state
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Questions (5 visible, the rest behind "Show N more"), each saying which risk or gap it closes
 * - Sources in citation order with retrieved dates; the full address in the tooltip
 */
import type { Profile } from "@/domain/claim";
import { CARD } from "../../ui";
import { retrievedLabel } from "./evidence";
import { type Ctx, Head, INTRO, More, NOTE } from "./profile-evidence";
import { CV_SOURCE_TEXT, isCvSource } from "./state";

function QuestionRows({ items, start }: { items: Profile["questions"]; start: number }): React.JSX.Element {
  return (
    <ol start={start} className="divide-y divide-divider">
      {items.map((q, i) => (
        <li key={q.text} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 py-3">
          <span className="text-sm font-semibold text-action tabular-nums">{String(start + i).padStart(2, "0")}</span>
          <span className="text-sm">
            <span className="font-semibold text-ink">{q.text}</span>
            {q.closes !== "" && (
              <span className={`mt-1 block ${NOTE}`}>
                closes: <span className="text-ink">{q.closes.replace(/^closes:?\s+/i, "")}</span>
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Questions({ items }: { items: Profile["questions"] }): React.JSX.Element {
  const VISIBLE = 5;
  const rest = items.slice(VISIBLE);
  return (
    <section className={CARD}>
      <Head id="ask" eyebrow="Interview" title="6. What to ask" />
      <p className={INTRO}>Interview questions from the risks and gaps above. Each says which one it closes.</p>
      <div className="mt-2">
        <QuestionRows items={items.slice(0, VISIBLE)} start={1} />
        {rest.length > 0 && (
          <More label={`Show ${String(rest.length)} more`}>
            <QuestionRows items={rest} start={VISIBLE + 1} />
          </More>
        )}
      </div>
    </section>
  );
}

/** Host plus path without scheme, www, query or trailing slash; the full address stays in href and title. */
const shortUrl = (url: string): string => url.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");

export function Sources({ ctx }: { ctx: Ctx }): React.JSX.Element | null {
  if (ctx.cite.size === 0) return null;
  return (
    <section className={CARD}>
      <More label={`Sources (${String(ctx.cite.size)})`}>
        <ol className="list-decimal pl-6 text-xs [overflow-wrap:anywhere]">
          {[...ctx.cite.keys()].map((id) => {
            const info = ctx.evidence.sourceOf.get(id);
            if (info === undefined) return null;
            return (
              <li key={id} className="py-1">
                {isCvSource(info.url) ? (
                  <span className="text-muted">{CV_SOURCE_TEXT}</span>
                ) : (
                  <a href={info.url} target="_blank" rel="noreferrer" title={info.url} className="pf-link text-action underline decoration-action/40 underline-offset-2 hover:decoration-action">
                    {shortUrl(info.url)}
                  </a>
                )}
                <span className="text-muted">{`\u00a0· ${retrievedLabel(info.fetched_at)}`}</span>
              </li>
            );
          })}
        </ol>
      </More>
    </section>
  );
}
