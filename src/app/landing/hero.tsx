/**
 * Landing hero: audience, promise, input → output in one sentence, two actions, proof points, and the product itself.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/hero.tsx
 * Deps:    ./parts, ./evidence-example
 * Tested:  n/a (visual; e2e/home.spec.ts checks the heading, actions and the evidence example)
 *
 * Key responsibilities:
 * - h1 "Walk into every interview knowing what to ask." set as three lines (second and third indented)
 * - Lede that names the input (position, LinkedIn profile or CV), the output (one page) and why it helps
 * - Create account / See a sample brief, then proof points that are true of the product today
 * - The interactive evidence example (requirement → evidence → question) instead of a photo
 *
 * Design constraints:
 * - Lines never wrap on large screens (nowrap from lg); the example sits beside the copy from lg, below it on smaller screens
 */
import { EvidenceExample } from "./evidence-example";
import { Ctas, PROOF } from "./parts";

export function Hero(): React.JSX.Element {
  return (
    <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-10 pb-16 md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,470px)] lg:gap-12 lg:pb-24">
      <div className="flex flex-col gap-6">
        <p className="flex items-center gap-2.5 text-sm font-semibold">
          <span aria-hidden="true" className="h-0.5 w-7 rounded bg-action" />
          For recruiters and hiring managers
        </p>
        <h1 className="text-[2.3rem] leading-[1.04] font-medium tracking-[-0.02em] sm:text-[3rem] lg:text-[3.05rem]">
          <span className="block lg:whitespace-nowrap">Walk into every</span>
          <span className="block pl-4 sm:pl-8 lg:whitespace-nowrap">interview knowing</span>
          <span className="block pl-4 sm:pl-8 lg:whitespace-nowrap">what to ask.</span>
        </h1>
        <p className="max-w-[46ch] text-lg leading-relaxed text-pretty text-muted">
          Add the position and the candidate&apos;s LinkedIn profile or CV. Radar reads their public professional work and gives you one
          page: each requirement with its source, what is still open, and the questions to ask.
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
      <EvidenceExample />
    </section>
  );
}
