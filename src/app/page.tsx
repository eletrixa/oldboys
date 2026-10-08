/**
 * Landing page: project name and the run-start form placeholder.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/page.tsx
 * Deps:    next, tailwindcss
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Show subject / anchor / goal inputs that will POST to /api/runs
 *
 * Design constraints:
 * - Server component; interactivity (fetch + SSE subscription) comes in a client component later
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">oldboys</h1>
        <p className="text-zinc-400">
          Subject + anchor + goal in. A report where every claim links to a source, fact is split from
          inference, and gaps are stated.
        </p>
      </header>

      <form className="flex flex-col gap-4 rounded-lg border border-zinc-800 p-6" aria-label="Start a run">
        <label className="flex flex-col gap-1 text-sm">
          Subject
          <input
            name="subject"
            placeholder="Person or company"
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
            disabled
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Anchor
          <input
            name="anchor"
            placeholder="City, website or IČO"
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
            disabled
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Goal
          <select name="goal" className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2" disabled>
            <option value="hiring">Hiring</option>
            <option value="due-diligence">Due diligence</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-100 px-4 py-2 font-medium text-zinc-900 disabled:opacity-50"
          disabled
        >
          Start research (form wiring TODO)
        </button>
      </form>
    </main>
  );
}
