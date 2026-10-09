/**
 * Landing trust half: how it works, FAQ and the closing call to action (careful by design lives in careful.tsx).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/trust.tsx
 * Deps:    next/link, ./parts, ../ui
 * Tested:  n/a (visual)
 *
 * Key responsibilities:
 * - Three real steps (position, candidate, brief) on hairlines, with a second Create account action under them
 * - Seven FAQ answers, the first (surveillance) open by default, GDPR legal basis answered in plain words
 * - Closing band on solid ink with the same two actions as the hero and the four proof points beside them, then the fictional-candidate / AI-photo disclosure
 *
 * Design constraints:
 * - Every promise matches the product: 7-day deletion (src/domain/audit.ts RETENTION_DAYS), candidate notice in
 *   English or Czech, access export, no scores, Art. 9 topics filtered; no price or legal-entity claims are made here
 * - FAQ uses native <details> so it works without JavaScript; its own summary class keeps the questions ink and 18px
 */
import Link from "next/link";
import { BTN_PRIMARY, Chevron, Eyebrow, TILE } from "../ui";
import { Ctas, PROOF, Section, Title } from "./parts";

const STEPS: readonly (readonly [string, string])[] = [
  ["Add the position", "Paste a job link or describe the role. Radar lists the must-haves, and you can edit them."],
  ["Add the candidate", "Their LinkedIn profile or CV. Radar reads public professional work for this role only."],
  ["Get one page", "Summary, evidence per must-have, and the gaps to ask about. Usually 2 to 4 minutes."],
];

const FAQ: readonly (readonly [string, string])[] = [
  ["Is this surveillance?", "No. Radar reads only public professional work and what the candidate gave you, for one role. It never uses private accounts, closed groups or face matching, and it stops when the brief is ready."],
  ["Is this allowed under GDPR?", "Radar is built for the legitimate-interest route: one named role, public professional sources only, a notice to the candidate with the right to object, an access export on request, and deletion after seven days. Your privacy team decides whether that fits your process; the brief's audit record shows who started it and which services processed it."],
  ["Does Radar score or rank candidates?", "Never. It shows what a source backs up and what is still open. You decide."],
  ["What does the candidate get?", "A ready-made notice you can send them: who researched, why, which sources were searched, the links confirmed as theirs, and how to object. If they ask for their data, you can export everything the brief holds about them in one file."],
  ["What if someone has almost no online presence?", "That is normal for many roles and never counts against anyone. The gaps become questions for the interview or a reference check."],
  ["How long do you keep data?", "Seven days. The brief, the saved excerpts and any CV are deleted automatically, and every brief has an audit record of who started it and which services processed it."],
  ["Which roles does it work for?", "Any role where professional work leaves a public trace: engineering, design, marketing, sales, leadership. For roles with little public evidence, Radar works from the CV."],
];

const FAQ_SUMMARY = "flex min-h-12 cursor-pointer list-none items-center gap-3 font-serif text-lg text-ink hover:text-action [&::-webkit-details-marker]:hidden";

export function How(): React.JSX.Element {
  return (
    <Section id="how">
      <div className="flex flex-col gap-3">
        <Eyebrow>How it works</Eyebrow>
        <Title lead="Three steps, 2 to 4 minutes." />
      </div>
      <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
        {STEPS.map(([t, b], i) => (
          <li key={t} className={TILE}>
            <span className="font-serif text-4xl leading-none text-action tabular-nums">{i + 1}</span>
            <h3 className="text-lg font-semibold">{t}</h3>
            <p className="text-sm leading-relaxed text-pretty text-muted">{b}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/register" className={BTN_PRIMARY}>
          Create account
        </Link>
        <p className="text-sm text-muted">Your first brief takes a job link and a LinkedIn profile.</p>
      </div>
    </Section>
  );
}

export function Faq(): React.JSX.Element {
  return (
    <Section id="faq" className="grid gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-14">
      <Title lead="Questions HR teams ask." />
      <div className="flex flex-col border-t border-divider">
        {FAQ.map(([q, a], i) => (
          <details key={q} open={i === 0} className="group border-b border-divider py-2">
            <summary className={FAQ_SUMMARY}>
              <Chevron />
              {q}
            </summary>
            <p className="pb-3 pl-6 leading-relaxed text-pretty text-muted">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Closing(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 md:pb-24">
      <div className="grid gap-10 rounded-3xl bg-ink px-6 py-14 text-white md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center md:px-12 md:py-20">
        <div className="flex max-w-[34rem] flex-col gap-4">
          <h2 className="font-serif text-[2rem] leading-[1.1] text-balance md:text-[2.75rem]">Your next interview, better prepared.</h2>
          <p className="text-lg text-pretty text-white/85">Create your team account and run your first brief today.</p>
          <div className="mt-2">
            <Ctas onDark />
          </div>
        </div>
        <ul className="flex flex-col gap-3 border-t border-white/20 pt-6 text-white/80 md:border-t-0 md:border-l md:pt-0 md:pl-10">
          {PROOF.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-peach" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-muted">The sample brief shows a fictional candidate. Marketing photography is AI-generated and shows no faces.</p>
    </section>
  );
}
