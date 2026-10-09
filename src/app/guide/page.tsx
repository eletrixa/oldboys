/**
 * Guide page: a public, plain-words walk through the first brief for a recruiter who has never used Radar.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/guide/page.tsx
 * Deps:    next/link, ../api/_lib/current-user, ../ui, ./guide-content
 * Tested:  src/app/guide/__tests__/guide-content.test.ts
 *
 * Key responsibilities:
 * - Sections #before, #steps (step 4 is #read), #words, #help, the "Radar never" card and one closing action
 * - One rust action: "Start a brief" (/briefs/new) with a session, "Create account" (/register) plus "Log in" without
 *
 * Design constraints:
 * - Public: reads the session only to pick the action, never redirects, shows no candidate data
 * - The text lives in guide-content.ts; bold words are exact UI labels and the test keeps them in step with the app
 * - Pictures of UI are spans in a FRAG, never real buttons or links; troubleshooting is native <details> (works without JS)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "../api/_lib/current-user";
import { BTN_PRIMARY, CARD_SAGE, Chevron, Eyebrow, FRAG, KEY, LINK, SUMMARY, TILE } from "../ui";
import { BEFORE, HEADER, HELP, NEVER, QUESTION, type Rich, STEPS, WORDS } from "./guide-content";

export const metadata: Metadata = { title: "Guide" };

const SECTION = "flex scroll-mt-20 flex-col gap-4";
const H2 = "font-serif text-2xl";
/** A picture of a button inside a FRAG: looks like one, is plain text. */
const FAKE_BTN = "inline-flex items-center rounded-lg border border-line bg-surface px-3 py-1.5 font-medium text-ink";

function Text({ rich }: { rich: Rich }): React.JSX.Element {
  return (
    <>
      {rich.map((s, i) => (typeof s === "string" ? s : <strong key={i} className="font-semibold text-ink">{s.label}</strong>))}
    </>
  );
}

function Question(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={KEY}>{QUESTION.key}</p>
      <div className={FRAG}>
        <p className="font-serif text-lg leading-snug">{QUESTION.text}</p>
        <p className="flex flex-wrap gap-2">
          {QUESTION.answers.map((a) => <span key={a.label} className={FAKE_BTN}>{a.label}</span>)}
        </p>
      </div>
    </div>
  );
}

export default async function GuidePage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3 border-b border-divider pb-8">
        <Eyebrow>{HEADER.eyebrow}</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">{HEADER.title}</h1>
        <p className="max-w-[62ch] text-muted">{HEADER.lead}</p>
        <p className="text-sm text-muted">{HEADER.meta}</p>
      </header>

      <section id="before" aria-labelledby="before-h" className={SECTION}>
        <h2 id="before-h" className={H2}>{BEFORE.title}</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
          {BEFORE.items.map((r, i) => <li key={i}><Text rich={r} /></li>)}
        </ul>
      </section>

      <section id="steps" aria-labelledby="steps-h" className={SECTION}>
        <h2 id="steps-h" className={H2}>Five steps</h2>
        <ol className="flex flex-col gap-8">
          {STEPS.map((s, i) => (
            <li key={s.id} id={s.id} className={`${TILE} scroll-mt-20`}>
              <span className="font-serif text-4xl leading-none text-action tabular-nums">{i + 1}</span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              {s.body.map((r, j) => (
                <div key={j} className="flex flex-col gap-2.5">
                  <p className="text-sm leading-relaxed text-pretty text-muted"><Text rich={r} /></p>
                  {s.question === true && j === 0 && <Question />}
                </div>
              ))}
            </li>
          ))}
        </ol>
      </section>

      <section id="words" aria-labelledby="words-h" className={SECTION}>
        <h2 id="words-h" className={H2}>Words you will see</h2>
        <dl className="divide-y divide-divider border-y border-divider">
          {WORDS.map((w) => (
            <div key={w.term} className="flex flex-col gap-1 py-3 md:grid md:grid-cols-[12rem_1fr] md:gap-4">
              <dt className="text-sm font-semibold">{w.term}</dt>
              <dd className="text-sm leading-relaxed text-muted"><Text rich={w.text} /></dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="never-h" className={`${CARD_SAGE} flex flex-col gap-3`}>
        <h2 id="never-h" className="text-base font-semibold">{NEVER.title}</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {NEVER.items.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>

      <section id="help" aria-labelledby="help-h" className={SECTION}>
        <h2 id="help-h" className={H2}>If something goes wrong</h2>
        <div className="flex flex-col border-t border-divider">
          {HELP.map((h) => (
            <details key={h.q} className="group border-b border-divider py-1">
              <summary className={SUMMARY}>
                <Chevron />
                {h.q}
              </summary>
              <p className="pb-3 pl-5 text-sm leading-relaxed text-muted"><Text rich={h.a} /></p>
            </details>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {user === null ? (
          <p className="flex flex-wrap items-center gap-4">
            <Link href="/register" className={BTN_PRIMARY}>Create account</Link>
            <span className="text-sm text-muted">Have an account? <Link href="/login" className={LINK}>Log in</Link></span>
          </p>
        ) : (
          <Link href="/briefs/new" className={`${BTN_PRIMARY} self-start`}>Start a brief</Link>
        )}
        <p className="text-sm text-muted">
          <Link href="/validation" className={LINK}>What is real, simulated or unfinished</Link>
        </p>
      </div>
    </main>
  );
}
