/**
 * Landing trust half: how it works, careful by design, FAQ and the closing call to action.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/trust.tsx
 * Deps:    next/link, ./parts, ../ui
 * Tested:  n/a (visual)
 *
 * Key responsibilities:
 * - Three real steps (position, candidate, brief) with a second Create account action under them
 * - Four "careful by design" rows beside the folder photo
 * - Seven FAQ answers, the first (surveillance) open by default, GDPR legal basis answered in plain words
 * - Closing band on solid ink with the same two actions as the hero, then the fictional-candidate / AI-photo disclosure
 *
 * Design constraints:
 * - Every promise matches the product: 7-day deletion (src/domain/audit.ts RETENTION_DAYS), candidate notice in
 *   English or Czech, access export, no scores, Art. 9 topics filtered; no price or legal-entity claims are made here
 * - FAQ uses native <details> so it works without JavaScript; its own summary class keeps the questions ink and 18px
 */
import Link from "next/link";
import { BTN_PRIMARY, Chevron, Eyebrow } from "../ui";
import { Ctas, Photo, Section, Title } from "./parts";

const STEPS: readonly (readonly [string, string])[] = [
  ["Add the position", "Paste a job link or describe the role. Radar lists the must-haves, and you can edit them."],
  ["Add the candidate", "Their LinkedIn profile or CV. Radar reads public professional work for this role only."],
  ["Get one page", "Summary, evidence per must-have, and the gaps to ask about. Usually in a few minutes."],
];

const CAREFUL: readonly (readonly [string, string])[] = [
  ["Never looked at", "Private accounts, closed groups, health, beliefs, family, origin or political views. Faces are never matched."],
  ["No scores, ever", "Status words describe the research, not the person. Radar never rates, ranks or rejects anyone."],
  ["The candidate is told", "A plain-language notice says who looked, why, which sources, and how to object. In English or Czech."],
  ["Gone in seven days", "The research, saved excerpts and any CV are deleted automatically a week after the brief."],
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
        <Title lead="Three steps, a few minutes." />
      </div>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map(([t, b], i) => (
          <li key={t} className="flex flex-col gap-3 rounded-2xl border border-divider bg-surface p-6 shadow-[0_8px_30px_rgba(40,45,43,0.06)]">
            <span className="font-serif text-4xl text-action tabular-nums">{i + 1}</span>
            <h3 className="font-semibold">{t}</h3>
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

export function Careful(): React.JSX.Element {
  return (
    <Section id="trust" className="grid items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-14">
      <Photo src="/marketing/fair.jpg" alt="A tidy stack of printed pages held by a brass paper clip on a sage folder." className="aspect-[4/3] md:aspect-[4/5]" />
      <div className="flex flex-col gap-8">
        <Title lead="Careful by design." rest="The way hiring research should work." />
        <dl className="flex flex-col border-t border-divider">
          {CAREFUL.map(([t, b]) => (
            <div key={t} className="grid gap-1 border-b border-divider py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <dt className="font-semibold">{t}</dt>
              <dd className="text-pretty text-muted">{b}</dd>
            </div>
          ))}
        </dl>
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
      <div className="rounded-3xl bg-ink px-6 py-14 text-white md:px-12 md:py-20">
        <div className="flex max-w-[34rem] flex-col gap-4">
          <h2 className="font-serif text-[2rem] leading-[1.1] text-balance md:text-[2.75rem]">Your next interview, better prepared.</h2>
          <p className="text-lg text-pretty text-white/85">Create your team account and run your first brief today.</p>
          <div className="mt-2">
            <Ctas onDark />
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">The sample brief shows a fictional candidate. Marketing photography is AI-generated and shows no faces.</p>
    </section>
  );
}
