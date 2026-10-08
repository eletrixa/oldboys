/**
 * Home page: Candidate Brief intro and the start form.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/page.tsx
 * Deps:    next, ./start-form
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Heading, sub copy and the client start form (Screen 1)
 *
 * Design constraints:
 * - Server component; interactivity lives in start-form.tsx
 */
import { StartForm } from "./start-form";

export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Who are you looking into?</h1>
        <p className="text-zinc-400">
          We check public profiles and registries and give you a short brief with a source for every point.
        </p>
      </header>
      <StartForm />
    </main>
  );
}
