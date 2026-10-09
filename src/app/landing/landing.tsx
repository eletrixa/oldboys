/**
 * Public landing page for logged-out visitors at "/": what Radar is, why it is careful, and how to start.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/landing.tsx
 * Deps:    ./hero, ./story, ./trust
 * Tested:  e2e/home.spec.ts (logged-out "/" shows the landing and its two actions)
 *
 * Key responsibilities:
 * - Compose the sections in reading order: hero, problem, product, moments, how, trust, FAQ, closing
 *
 * Design constraints:
 * - Server component, no client JavaScript; the only actions are /register and /login
 * - Radar Visual Guideline: no scores, no surveillance imagery, no faces; photos are AI-generated and say so
 */
import { Hero } from "./hero";
import { Moments, Problem, Product } from "./story";
import { Careful, Closing, Faq, How } from "./trust";

export function Landing(): React.JSX.Element {
  return (
    <main>
      <Hero />
      <Problem />
      <Product />
      <Moments />
      <How />
      <Careful />
      <Faq />
      <Closing />
    </main>
  );
}
