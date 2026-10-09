/**
 * Working-style section of the candidate profile: DISC / MBTI, our read, trait rows and the Big Five block, all labelled inference.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-style.tsx
 * Deps:    react, src/domain/claim (types), ../../ui, ./profile-evidence, ./big-five
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Our read capped at 3 sentences behind "Show N more"; traits capped at 4; never an assessment of the person
 */
import type { Profile } from "@/domain/claim";
import { CARD_MUTED, Chevron, Pill, SUMMARY_COMPACT } from "../../ui";
import { BigFiveBlock } from "./big-five";
import { Capped, type Ctx, Dropped, EvidenceList, Head, MEASURE, NOTE, plural } from "./profile-evidence";

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
      <p className="mt-2">
        <Pill tone="inference">Inference from public writing, not an assessment of the person.</Pill>
      </p>
      <p className={`mt-2 ${NOTE}`}>
        Based only on their own posts, articles and interview text. No health, political, religious, ethnic or sexual-orientation data is used.
      </p>
      {/* One column on phones (label above value) so the read and its evidence keep the full card width. */}
      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-y-2">
        {types.length === 0 ? (
          <>
            <dt className={NOTE}>Type</dt>
            <dd className="text-muted">Not enough of their own writing to suggest a type</dd>
          </>
        ) : (
          types.map((v) => (
            <div key={v.label} className="contents">
              <dt className={`${NOTE} pt-px`}>{v.label}</dt>
              <dd className="text-ink">
                {`${v.label} ${v.type}`}
                <span className="text-muted">{`\u00a0· ${v.confidence} confidence`}</span>
              </dd>
            </div>
          ))
        )}
        {read.length > 0 && (
          <>
            <dt className={`${NOTE} pt-px`}>Our read</dt>
            <dd>
              <p className={`${MEASURE} text-ink`}>
                {read.slice(0, VISIBLE).join(" ")}
                {p.evidence.length === 0 && traits.length === 0 && <span className="text-muted"> (no supporting quote kept)</span>}
              </p>
              {read.length > VISIBLE && (
                <details className="group">
                  <summary className={SUMMARY_COMPACT}>
                    <Chevron />
                    {`Show ${plural(read.length - VISIBLE, "more sentence", "more sentences")}`}
                  </summary>
                  <p className={`${MEASURE} text-ink`}>{read.slice(VISIBLE).join(" ")}</p>
                </details>
              )}
              <EvidenceList items={p.evidence} ctx={ctx} about="our read" />
            </dd>
          </>
        )}
      </dl>
      {traits.length > 0 && <Capped items={traits} visible={4} ctx={ctx} quiet />}
      {p.big5 !== null && <BigFiveBlock big5={p.big5} evidence={(items, about) => <EvidenceList items={items} ctx={ctx} about={about} />} />}
      <Dropped n={p.evidence_dropped} />
    </section>
  );
}
