/**
 * Landing trust half: benefits, how it works, careful by design, FAQ and the closing call to action.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/trust.tsx
 * Deps:    next/image, ./parts, ../ui
 * Tested:  n/a (visual)
 *
 * Key responsibilities:
 * - Benefits (four), three real steps (position, candidate, brief), four "careful by design" rows, six FAQ answers
 * - Closing band over the empty meeting-room photo with the same two actions as the hero
 *
 * Design constraints:
 * - Every promise matches the product: 7-day deletion (src/domain/audit.ts RETENTION_DAYS), candidate notice in
 *   English or Czech, access export, no scores, Art. 9 topics filtered
 * - FAQ uses native <details> so it works without JavaScript
 */
import Image from "next/image";
import { Chevron, Eyebrow, SUMMARY } from "../ui";
import { Ctas, Photo, Section, Title } from "./parts";

const ICON: Record<string, string> = {
  kit: "M8 6h11M8 12h11M8 18h11M4 6h.01M4 12h.01M4 18h.01",
  source: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

const BENEFITS: readonly (readonly [string, string, string])[] = [
  ["Better questions", "Open points become interview questions you can copy into your kit, your ATS or a reference check.", "kit"],
  ["Every line is checkable", "Each finding opens the exact quote on the page it came from, with the date Radar read it.", "source"],
  ["Fair by default", "No scores, no rankings, public professional work only. Health, beliefs and family are filtered out.", "lock"],
  ["Your call, always", "Radar prepares the conversation. It never recommends, rejects or ranks anyone.", "check"],
];

const STEPS: readonly (readonly [string, string])[] = [
  ["Add the position", "Paste a job link or describe the role. Radar lists the must-haves, and you can edit them."],
  ["Add the candidate", "Their LinkedIn profile or CV. Radar reads public professional work for this role only."],
  ["Get one page", "What a source backs up, what is open, and the questions to ask. Usually in a few minutes."],
];

const CAREFUL: readonly (readonly [string, string])[] = [
  ["Never looked at", "Private accounts, closed groups, health, beliefs, family, origin or political views. Faces are never matched."],
  ["No scores, ever", "Radar shows what a source backs up and what is open. It never rates, ranks or rejects a person."],
  ["The candidate is told", "A plain-language notice says who looked, why, which sources, and how to object. English or Czech."],
  ["Gone in seven days", "The research, saved excerpts and any CV are deleted automatically a week after the brief."],
];

const FAQ: readonly (readonly [string, string])[] = [
  ["Is this surveillance?", "No. Radar reads only public professional work and what the candidate gave you, for one role. It never uses private accounts, closed groups or face matching, and it stops when the brief is ready."],
  ["Does Radar score or rank candidates?", "Never. It shows what a source backs up and what is still open. Status words describe the research, not the person. You decide."],
  ["What does the candidate get?", "A ready-made notice you can send them: who researched, why, which sources were searched, the links confirmed as theirs, and how to object. If they ask for their data, you can export everything the brief holds about them in one file."],
  ["What if someone has almost no online presence?", "That is normal for many roles and never counts against anyone. The gaps become questions for the interview or a reference check."],
  ["How long do you keep data?", "Seven days. The brief, the saved excerpts and any CV are deleted automatically, and every brief has an audit record of who started it and which services processed it."],
  ["Which roles does it work for?", "Any role where professional work leaves a public trace: engineering, design, marketing, sales, leadership. For roles with little public evidence, Radar works from the CV."],
];

function Icon({ name }: Readonly<{ name: string }>): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}

export function Benefits(): React.JSX.Element {
  return (
    <Section id="benefits">
      <Title lead="Less searching." rest="More thoughtful interviews." className="max-w-[22ch]" />
      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map(([t, b, ic]) => (
          <div key={t} className="flex flex-col gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-peach/60 text-action"><Icon name={ic} /></span>
            <h3 className="font-semibold">{t}</h3>
            <p className="text-sm leading-relaxed text-muted">{b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function How(): React.JSX.Element {
  return (
    <Section id="how">
      <div className="flex flex-col gap-3">
        <Eyebrow>How it works</Eyebrow>
        <Title lead="Three steps." rest="A few minutes." />
      </div>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map(([t, b], i) => (
          <li key={t} className="flex flex-col gap-3 rounded-2xl border border-divider bg-surface p-6 shadow-[0_8px_30px_rgba(40,45,43,0.06)]">
            <span className="font-serif text-4xl text-action tabular-nums">{i + 1}</span>
            <h3 className="font-semibold">{t}</h3>
            <p className="text-sm leading-relaxed text-muted">{b}</p>
          </li>
        ))}
      </ol>
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
              <dd className="text-muted">{b}</dd>
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
        {FAQ.map(([q, a]) => (
          <details key={q} className="group border-b border-divider py-2">
            <summary className={`${SUMMARY} text-base text-ink`}>
              <Chevron />
              {q}
            </summary>
            <p className="pb-3 pl-5 leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Closing(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 md:pb-24">
      <div className="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-14 text-white md:px-12 md:py-20">
        <Image src="/marketing/cta.jpg" alt="" width={1774} height={888} sizes="100vw" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
        <div className="flex max-w-[34rem] flex-col gap-4">
          <h2 className="font-serif text-[2rem] leading-[1.1] md:text-[2.75rem]">Your next interview, better prepared.</h2>
          <p className="text-lg text-white/85">Create your team account and run your first brief today.</p>
          <div className="mt-2">
            <Ctas onDark />
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">Product screenshots use a fictional candidate. Marketing photography is AI-generated.</p>
    </section>
  );
}
