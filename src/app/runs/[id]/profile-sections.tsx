/**
 * Enriched hiring profile on the report page, in the structure Robert approved (scratchpad prototype, 2026-10-09):
 * summary box, achievements, risks, history, working style, position fit, what to ask, sources. Every item carries its
 * evidence lines behind a native disclosure; caps from docs/research/profile-page-discovery.md §5 keep it compact.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-sections.tsx
 * Deps:    react, src/domain/claim (types), ../../ui (Radar primitives), ./evidence (Evidence, quoteLink, retrievedLabel)
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Verdict strip: run's role fit with a neutral bar and must-haves evidenced, risks, questions, FACT / INFERENCE and
 *   source counts, current role; FACT / INFERENCE legend; section anchors
 * - Sections in Robert's order with caps (3 / 3 / 5 jobs / 3 sentences / run's role / 5) and "Show N more"; empty ones omitted
 * - Evidence line: serif quote on a hairline rule, then one meta line: Independent / Self-reported pill (none on a weak INFERENCE), FACT / INFERENCE,
 *   supports / weakens / context, [n] source deep-linked at the quote, retrieved day, note;
 *   "source missing" for an unknown id; numbered Sources list with retrieved dates
 * - History as a timeline (date column, hairline, org · title); working style on a muted card with trait rows
 * - Position fit: one bar row per role, weighted capability table, formula behind a disclosure, Σ(weight × status) ÷ Σ(weight) computed here
 * - Position fit table stacks under 640px (name, status, labelled weights); each capability's evidence is a full-width row below it
 * - Sections live in profile-evidence, -history, -style, -fit, -ask and -summary; this file orders them
 * - Motion and print live in globals.css under `.profile` (details rise, bar grow, verdict stagger, link underline), all
 *   behind prefers-reduced-motion: no-preference; hooks are the pf-* class names
 * - Prose capped at a 65ch measure; evidence summaries carry the item name for screen readers; "·" separators bind to the
 *   text before them so a wrap never starts a line with one
 *
 * Design constraints:
 * - Server-safe and pure: native <details>, no hooks; Radar semantic tokens only; no colour scale on fit %
 * - Working style and fit are labelled as inference / evidence coverage, never an assessment or a prediction
 * - Briefs stored before direction / note / detail / location / duration / traits / weight existed render through the
 *   schema defaults (direction falls back to `supports`)
 */
import type { Profile, ProfileEvidence, ProfileItem } from "@/domain/claim";
import { CARD } from "../../ui";
import type { Evidence } from "./evidence";
import { Capped, type Cite, type Ctx, Dropped, Head, INTRO } from "./profile-evidence";
import { Questions, Sources } from "./profile-ask";
import { Fit, orderFits } from "./profile-fit";
import { History } from "./profile-history";
import { WorkingStyle } from "./profile-style";
import { SummaryBox } from "./profile-summary";

function allEvidence(p: Profile): ProfileEvidence[] {
  const items = (xs: { evidence: ProfileEvidence[] }[]): ProfileEvidence[] => xs.flatMap((x) => x.evidence);
  return [
    ...items(p.achievements),
    ...items(p.risks),
    ...items(p.history),
    ...items(p.personality.traits),
    ...p.personality.evidence,
    ...items(p.personality.big5?.traits ?? []),
    ...p.position_fit.flatMap((f) => items(f.traits)),
  ];
}

function citeOf(all: ProfileEvidence[], evidence: Evidence): Cite {
  const cite = new Map<string, number>();
  for (const e of all) if (evidence.sourceOf.has(e.source_id) && !cite.has(e.source_id)) cite.set(e.source_id, cite.size + 1);
  return cite;
}

function Items(props: { id: string; eyebrow: string; title: string; intro: string; items: ProfileItem[]; dropped: number; ctx: Ctx }): React.JSX.Element {
  return (
    <section className={CARD}>
      <Head id={props.id} eyebrow={props.eyebrow} title={props.title} />
      <p className={INTRO}>{props.intro}</p>
      <Capped items={props.items} visible={3} ctx={props.ctx} />
      <Dropped n={props.dropped} />
    </section>
  );
}

export function ProfileSections({ profile, evidence, role = null }: { profile: Profile; evidence: Evidence; role?: string | null }): React.JSX.Element {
  if (profile.degraded !== null) return <p className="text-sm text-muted">Profile not built: {profile.degraded}</p>;
  const p = profile.personality;
  const all = allEvidence(profile);
  const ctx: Ctx = { evidence, cite: citeOf(all, evidence) };
  const fits = orderFits(profile.position_fit, role);
  const show = {
    achievements: profile.achievements.length > 0,
    risks: profile.risks.length > 0,
    history: profile.history.length > 0,
    "working-style": p.disc !== null || p.mbti !== null || p.big5 !== null || p.read !== "" || p.traits.length > 0,
    fit: fits.length > 0,
    ask: profile.questions.length > 0,
  };
  const present = new Set(Object.entries(show).flatMap(([k, v]) => (v ? [k] : [])));
  // `profile` scopes the motion and print rules in globals.css; 24px between sections on phones, 32px from md up.
  return (
    <div className="profile flex flex-col gap-6 md:gap-8">
      <SummaryBox profile={profile} fits={fits} all={all} ctx={ctx} present={present} />
      {(show.achievements || show.risks) && (
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          {show.achievements && (
            <Items
              id="achievements"
              eyebrow="Track record"
              title="1. Achievements"
              intro="Concrete results credited to them. Most are self-reported; the evidence marks what confirms or limits each one."
              items={profile.achievements}
              dropped={profile.achievements_dropped}
              ctx={ctx}
            />
          )}
          {show.risks && (
            <Items
              id="risks"
              eyebrow="To check"
              title="2. Risks"
              intro="Hiring risks visible in public data. Each is a fact pattern to check, not a judgement of the person."
              items={profile.risks}
              dropped={profile.risks_dropped}
              ctx={ctx}
            />
          )}
        </div>
      )}
      {show.history && <History entries={profile.history} dropped={profile.history_dropped} ctx={ctx} />}
      {show["working-style"] && <WorkingStyle p={p} ctx={ctx} />}
      {show.fit && <Fit fits={fits} dropped={profile.fit_dropped} ctx={ctx} />}
      {show.ask && <Questions items={profile.questions} />}
      <Sources ctx={ctx} />
    </div>
  );
}
