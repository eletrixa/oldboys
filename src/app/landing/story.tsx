/**
 * Landing story: the product (a readable sample brief) and the before/during interview moments.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/story.tsx
 * Deps:    ./parts, ./sample-brief, ./evidence-data, ../ui
 * Tested:  n/a (visual)
 *
 * Key responsibilities:
 * - Product: the live SampleBrief with three numbered callouts (sticky on desktop) that point at its summary, requirement cards and limits line
 * - Moments: Before (the brief at a glance: one row per requirement with its coverage word) and During (questions with
 *   the reason to ask them), each as a snippet over a photo; photos add human context, the snippet carries the point
 *
 * Design constraints:
 * - Copy only claims what the run page does today (evidence per criterion, to-verify list, not searched, kit)
 * - Each section adds a new concrete detail instead of repeating the hero's sentence
 */
import { Eyebrow, KEY, Pill, type Tone } from "../ui";
import { NONE, PARTIAL } from "./evidence-data";
import { Photo, Section, Title } from "./parts";
import { SampleBrief } from "./sample-brief";

const CALLOUTS: readonly (readonly [string, string])[] = [
  ["The 30-second summary", "Confirmed, missing and the one question to ask first. Read it in the corridor."],
  ["Evidence per requirement", "Evidenced, partial or none, in words. Each fact opens the quote and the page it came from, with the date Radar read it."],
  ["Research limits", "Which sources were searched, which were skipped, and that nothing about private life was collected."],
];

export function Product(): React.JSX.Element {
  return (
    <Section id="product">
      <div className="flex max-w-[44rem] flex-col gap-4">
        <Eyebrow>The brief</Eyebrow>
        <Title lead="One page your hiring manager will actually read." />
        <p className="text-lg leading-relaxed text-pretty text-muted">
          A fictional example, in the exact layout you get. Every point opens the quote and the page it came from.
        </p>
      </div>
      <div className="mt-10 grid items-start gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-12">
        <ol className="flex flex-col gap-5 md:sticky md:top-24 md:order-2">
          {CALLOUTS.map(([t, b], i) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-action font-serif text-sm text-white tabular-nums">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm leading-relaxed text-pretty text-muted">{b}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="md:order-1">
          <SampleBrief />
        </div>
      </div>
    </Section>
  );
}

const GLANCE: readonly (readonly [string, Tone, string])[] = [
  ["Writes production SQL", "ok", "evidenced"],
  ["Python", "ok", "evidenced"],
  ["Cloud data platforms", "unsure", "partial"],
  ["Has led a team of at least three engineers", "neutral", "none"],
];

const SNIP = "relative mx-3 -mt-12 flex flex-col gap-2 rounded-xl border border-divider bg-paper p-4 shadow-[0_18px_44px_rgba(40,45,43,0.14)] sm:mx-4";

function Moment({ when, title, body, children }: Readonly<{ when: string; title: string; body: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-[0.08em] text-action uppercase">{when}</p>
      <h3 className="font-serif text-2xl text-balance md:text-[1.75rem]">{title}</h3>
      <p className="max-w-[46ch] text-pretty text-muted">{body}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function Moments(): React.JSX.Element {
  const partial = PARTIAL;
  const none = NONE;
  return (
    <Section id="day">
      <div className="flex max-w-[40rem] flex-col gap-3">
        <Eyebrow>Before and during the interview</Eyebrow>
        <Title lead="Less time searching." rest="More of the conversation that matters." />
      </div>
      <div className="mt-12 grid gap-14 md:grid-cols-2 md:gap-10">
        <Moment when="Before" title="Read one page, not ten tabs." body="Each requirement sits next to its coverage word and its source, so you know what is backed up before the candidate walks in.">
          <Photo src="/marketing/moment-prepare.jpg" alt="Hands underlining a highlighted line on a printed one-page brief." className="aspect-[16/10]" />
          <div className={SNIP}>
            <span className={KEY}>Jan&apos;s brief at a glance</span>
            <ul className="flex flex-col divide-y divide-divider text-[15px]">
              {GLANCE.map(([t, tone, word]) => (
                <li key={t} className="flex items-center justify-between gap-3 py-2">
                  <span>{t}</span>
                  <Pill tone={tone}>{word}</Pill>
                </li>
              ))}
            </ul>
          </div>
        </Moment>
        <Moment when="During" title="Ask questions that start from the evidence." body="Each question carries the reason to ask it. Copy them into your interview kit, your ATS or a reference check.">
          <Photo src="/marketing/moment-interview.jpg" alt="Two people talking across a table in a bright meeting room, faces not visible." className="aspect-[16/10]" />
          <div className={SNIP}>
            <span className={KEY}>Questions with a reason</span>
            <div className="flex flex-col gap-1 border-b border-divider pb-3">
              <p className="font-serif text-[17px] leading-snug text-pretty">“{partial.question}”</p>
              <span className="text-[13px] text-muted">Why ask: partial. {partial.why.open}</span>
            </div>
            <div className="flex flex-col gap-1 pt-1">
              <p className="font-serif text-[17px] leading-snug text-pretty">“{none.question}”</p>
              <span className="text-[13px] text-muted">Why ask: none. No public source mentions leading a team.</span>
            </div>
          </div>
        </Moment>
      </div>
    </Section>
  );
}
