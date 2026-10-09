/**
 * Landing story: the problem, the product (a readable sample brief) and the before/during interview moments.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/story.tsx
 * Deps:    ./parts, ./sample-brief, ../ui
 * Tested:  n/a (visual)
 *
 * Key responsibilities:
 * - Problem: three short cards beside the "too many tabs" photo (photo shorter on phones, where it carries no information)
 * - Product: the live SampleBrief with three numbered callouts (sticky on desktop) that point at its summary, requirement cards and limits line
 * - Moments: Before (read one page) and During (ask what matters, copy the questions into your kit or ATS)
 *
 * Design constraints:
 * - Copy only claims what the run page does today (evidence per criterion, to-verify list, not searched, kit)
 * - Each section adds a new concrete detail instead of repeating the hero's sentence
 */
import { Eyebrow } from "../ui";
import { Photo, Section, Title } from "./parts";
import { SampleBrief } from "./sample-brief";

const PROBLEMS: readonly (readonly [string, string])[] = [
  ["Thirty minutes with a stranger", "A CV, a profile page and half an hour. The best questions usually come to you after the interview."],
  ["Ten tabs, nothing to share", "You search, skim and remember a few things. None of it reaches the hiring manager in a form they can check."],
  ["Unsure what is fair to look at", "Some of what turns up online should not count. In a hurry, the line is hard to see."],
];

const CALLOUTS: readonly (readonly [string, string])[] = [
  ["The 30-second summary", "Confirmed, missing and the one question to ask first. Read it in the corridor."],
  ["Evidence per requirement", "Evidenced, partial or none, in words. Each fact opens the quote and the page it came from, with the date Radar read it."],
  ["Research limits", "Which sources were searched, which were skipped, and that nothing about private life was collected."],
];

export function Problem(): React.JSX.Element {
  return (
    <Section id="problem" hairline={false} className="grid items-start gap-10 md:grid-cols-2 md:gap-14">
      <div className="flex flex-col gap-8">
        <Title lead="The CV says a lot." rest="It proves little." />
        <div className="flex flex-col gap-3">
          {PROBLEMS.map(([t, b]) => (
            <div key={t} className="rounded-2xl border border-divider bg-surface/70 p-5">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{b}</p>
            </div>
          ))}
        </div>
      </div>
      <Photo src="/marketing/problem.jpg" alt="A laptop crowded with open browser tabs late in the evening." className="aspect-[16/9] md:aspect-[4/4.6]" />
    </Section>
  );
}

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

function Moment({ when, title, body, children }: Readonly<{ when: string; title: string; body: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">{children}</div>
      <p className="mt-2 text-xs font-semibold tracking-[0.08em] text-action uppercase">{when}</p>
      <h3 className="font-serif text-2xl text-balance">{title}</h3>
      <p className="max-w-[46ch] text-pretty text-muted">{body}</p>
    </div>
  );
}

export function Moments(): React.JSX.Element {
  return (
    <Section id="day">
      <div className="flex max-w-[40rem] flex-col gap-3">
        <Eyebrow>Before and during the interview</Eyebrow>
        <Title lead="Prepared in minutes, present for the conversation." />
      </div>
      <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-10">
        <Moment
          when="Before"
          title="Read one page, not ten tabs"
          body="The brief arrives a few minutes after you add the candidate. Each requirement is marked evidenced, partial or none, with the quote underneath."
        >
          <Photo src="/marketing/moment-prepare.jpg" alt="Hands underlining a highlighted line on a printed brief." className="aspect-[4/3]" />
        </Moment>
        <Moment
          when="During"
          title="Ask what actually matters"
          body="Open points become questions you can copy into your interview kit, your ATS or a reference check. Start where the brief ends: the project they shipped, the team they say they led."
        >
          <Photo src="/marketing/moment-interview.jpg" alt="Two people talking across a table in a bright meeting room, faces not visible." className="aspect-[4/3]" />
          <div className="absolute right-4 bottom-4 left-4 rounded-xl bg-surface/95 p-4 shadow-lg backdrop-blur md:left-auto md:max-w-[19rem]">
            <p className="font-serif text-[15px] leading-snug text-pretty">“Have you led other engineers? Tell me about one decision you made for the team.”</p>
            <p className="mt-1 text-xs text-muted">Suggested interview question</p>
          </div>
        </Moment>
      </div>
    </Section>
  );
}
