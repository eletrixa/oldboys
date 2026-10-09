/**
 * Landing hero: the promise, two actions, four proof points and the desk photo with a real-looking finding card.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/hero.tsx
 * Deps:    ./parts, ../ui
 * Tested:  n/a (visual; e2e/home.spec.ts checks the heading and actions)
 *
 * Key responsibilities:
 * - h1 "Walk into every interview knowing what to ask." with balanced wrapping
 * - Create account / See a sample brief, then proof points that are true of the product (sources, no scores, notice, 7-day deletion) in a 2×2 grid
 * - Finding card floating over the photo: one claim, its quote and its source, the way the brief shows it; "Show evidence" jumps to the sample
 *
 * Design constraints:
 * - The card illustrates the brief's format with an invented quote, so it names no person or employer
 */
import { Pill } from "../ui";
import { Ctas, Photo, PROOF } from "./parts";

function FindingCard(): React.JSX.Element {
  return (
    <div className="relative mx-4 -mt-16 flex flex-col gap-2 rounded-2xl border border-divider bg-surface p-4 shadow-[0_18px_50px_rgba(40,45,43,0.16)] sm:mx-auto sm:max-w-sm lg:absolute lg:bottom-[-28px] lg:left-[-48px] lg:mx-0 lg:mt-0 lg:w-[310px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Finding</span>
        <Pill tone="ok">evidenced</Pill>
      </div>
      <p className="text-[15px] font-semibold">Explains technical choices clearly</p>
      <p className="font-serif text-[15px] leading-snug text-pretty">
        <span className="bg-peach/70 box-decoration-clone px-0.5">“We moved the nightly pipeline to incremental loads and cut the bill by a third.”</span>
      </p>
      <p className="text-[13px] text-muted">
        Personal blog · read 3 Oct ·{" "}
        <a href="#product" className="font-semibold text-action underline decoration-action/40 underline-offset-4 hover:decoration-action">
          Show evidence
        </a>
      </p>
    </div>
  );
}

export function Hero(): React.JSX.Element {
  return (
    <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 pt-12 pb-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-10 md:pt-16 md:pb-20">
      <div className="flex flex-col gap-7">
        <p className="w-fit rounded-full bg-peach/60 px-3 py-1 text-xs font-semibold tracking-[0.06em] text-action uppercase">
          For recruiters and hiring managers
        </p>
        <h1 className="max-w-[14ch] text-[2.25rem] leading-[1.06] text-balance sm:text-[2.6rem] md:text-[3.25rem] lg:text-[3.6rem]">
          Walk into every interview knowing what to ask.
        </h1>
        <p className="max-w-[46ch] text-lg leading-relaxed text-pretty text-muted">
          Radar reads a candidate&apos;s public professional work and hands you one page: what a source backs up, what is still
          open, and the questions worth asking.
        </p>
        <Ctas />
        <ul className="grid max-w-[30rem] grid-cols-2 gap-x-5 gap-y-2 text-sm text-muted">
          {PROOF.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-action" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative">
        <Photo
          src="/marketing/hero.jpg"
          alt="A calm desk by a window with a printed one-page brief, a coffee cup and a notebook."
          className="aspect-[4/5] sm:aspect-[16/10] lg:aspect-[4/5]"
          position="58% 50%"
          priority
        />
        <FindingCard />
      </div>
    </section>
  );
}
