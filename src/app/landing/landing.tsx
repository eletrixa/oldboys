/**
 * Public landing page for logged-out visitors at "/": what Radar is, why it is careful, and how to start.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/landing.tsx
 * Deps:    ./hero, ./story, ./careful, ./trust
 * Tested:  e2e/home.spec.ts (logged-out "/" shows the landing, its two actions and the evidence example)
 *
 * Key responsibilities:
 * - Compose the sections in reading order: hero (interactive evidence example), product, how, moments, trust, FAQ, closing
 *
 * Design constraints:
 * - Server component; the only client island is the hero's evidence example; the only actions are /register and /login
 * - Radar Visual Guideline: no scores, no surveillance imagery, no faces; photos are AI-generated and say so
 */
import { Hero } from "./hero";
import { Careful } from "./careful";
import { Moments, Product } from "./story";
import { Closing, Faq, How } from "./trust";

export function Landing(): React.JSX.Element {
  return (
    <main>
      <Hero />
      <Product />
      <How />
      <Moments />
      <Careful />
      <Faq />
      <Closing />
    </main>
  );
}
