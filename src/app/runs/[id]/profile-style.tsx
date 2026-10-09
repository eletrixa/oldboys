/**
 * Working-style section of the candidate profile: our read, the Big Five block, trait notes and DISC / MBTI, all inference.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-style.tsx
 * Deps:    react, src/domain/claim (types), src/app/_lib/plural, ../../ui, ./big-five, ./evidence-line, ./profile-evidence
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - One deck sentence under the heading says it is read only from their own writing, never an assessment of the person
 * - Our read first (3 sentences visible, the rest behind "Show N more"), then the Big Five block with own-words evidence
 * - Trait notes: 4 visible when there is no Big Five read, otherwise all behind "Other trait notes (n)"
 * - Type labels last: the dt names DISC / MBTI, the dd prints only the type and its confidence
 */
import type { Profile } from "@/domain/claim";
import { CARD_MUTED, Chevron, KEY, SUMMARY_COMPACT } from "../../ui";
import { BigFiveBlock } from "./big-five";
import { type Ctx, MEASURE, NOTE, OwnWords } from "./evidence-line";
import { plural } from "@/app/_lib/plural";
import { Capped, Dropped, EvidenceList, Head, INTRO, ItemRows, More } from "./profile-evidence";

/** Sentence split for model prose; no abbreviation handling. */
const sentences = (text: string): string[] => text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g)?.map((s) => s.trim()) ?? [];

export function WorkingStyle({ p, ctx }: { p: Profile["personality"]; ctx: Ctx }): React.JSX.Element {
  const types = [
    { label: "DISC", v: p.disc },
    { label: "MBTI", v: p.mbti },
  ].flatMap(({ label, v }) => (v === null ? [] : [{ label, ...v }]));
  const read = sentences(p.read);
  const { traits } = p;
  // One hidden sentence is not worth a disclosure: collapse only when two or more would be hidden.
  const VISIBLE = read.length <= 4 ? read.length : 3;
  return (
    <section className={CARD_MUTED}>
      <Head id="working-style" eyebrow="Inference" title="4. Working style" />
      <p className={INTRO}>
        Read only from their own posts, articles and interview answers, never an assessment of the person. No health, political, religious, ethnic or
        sexual-orientation data is used.
      </p>
      {read.length > 0 && (
        <div className="mt-4">
          <h3 className={KEY}>Our read</h3>
          <p className={`mt-1 ${MEASURE} text-sm text-ink`}>
            {read.slice(0, VISIBLE).join(" ")}
            {p.evidence.length === 0 && traits.length === 0 && <span className="text-muted"> (no supporting quote kept)</span>}
          </p>
          {read.length > VISIBLE && (
            <details className="group">
              <summary className={SUMMARY_COMPACT}>
                <Chevron />
                {`Show ${plural(read.length - VISIBLE, "more sentence", "more sentences")}`}
              </summary>
              <p className={`${MEASURE} text-sm text-ink`}>{read.slice(VISIBLE).join(" ")}</p>
            </details>
          )}
          <EvidenceList items={p.evidence} ctx={ctx} about="our read" />
        </div>
      )}
      {p.big5 !== null && <BigFiveBlock big5={p.big5} evidence={(items, about, open) => <OwnWords items={items} ctx={ctx} about={about} open={open} />} />}
      {traits.length > 0 &&
        (p.big5 === null ? (
          <Capped items={traits} visible={4} ctx={ctx} quiet />
        ) : (
          <div className="mt-2">
            <More label={`Other trait notes (${String(traits.length)})`}>
              <ItemRows items={traits} ctx={ctx} quiet />
            </More>
          </div>
        ))}
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-divider pt-3 text-sm">
        {types.length === 0 ? (
          <>
            <dt className={NOTE}>Type</dt>
            <dd className="text-muted">Not enough of their own writing to suggest a type</dd>
          </>
        ) : (
          types.map((v) => (
            <div key={v.label} className="contents">
              <dt className={`${NOTE} pt-px`}>{v.label}</dt>
              <dd className="text-muted">
                <span className="text-ink">{v.type}</span>
                {` · ${v.confidence} confidence`}
              </dd>
            </div>
          ))
        )}
      </dl>
      <Dropped n={p.evidence_dropped} />
    </section>
  );
}
