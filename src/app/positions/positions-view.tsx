/**
 * Positions list: search, sections per role family, one card per position.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/positions-view.tsx
 * Deps:    react, next/link, src/domain/position-links, ./use-authed-json, ./auth-states
 * Tested:  helpers in src/domain/__tests__/position-links.test.ts; view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - GET /api/positions with the stored token, group by family, filter title/company client-side
 * - Empty state with one call to action to /positions/new
 *
 * Design constraints:
 * - Client component; no request without a token
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PositionListItem } from "@/app/api/positions/handler";
import { filterPositions, groupByFamily, ingestLabel } from "@/domain/position-links";
import { AuthStates } from "./auth-states";
import { useAuthedJson } from "./use-authed-json";

const CTA = "rounded-xl bg-teal-500 px-4 py-2 font-medium text-zinc-950 hover:bg-teal-400 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none";

function PositionRow({ p }: { p: PositionListItem }): React.JSX.Element {
  const meta = [p.company, p.location, `${String(p.runs)} ${p.runs === 1 ? "run" : "runs"}`, ingestLabel(p.ingest_method)].filter(Boolean);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-900">
      <div className="flex min-w-0 flex-col">
        <Link href={`/positions/${encodeURIComponent(p.id)}`} className="font-medium text-zinc-100 hover:text-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none">
          {p.title}
        </Link>
        <span className="text-sm text-zinc-400">{meta.join(" · ")}</span>
      </div>
      {p.posting_url !== null && (
        <a href={p.posting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-300 underline-offset-2 hover:underline">
          Open posting
        </a>
      )}
    </li>
  );
}

function PositionSections({ items }: { items: PositionListItem[] }): React.JSX.Element {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupByFamily(filterPositions(items, query)), [items, query]);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-zinc-400">No positions yet. Add one from its posting and start researching candidates against it.</p>
        <Link href="/positions/new" className={CTA}>Add a position</Link>
      </div>
    );
  }
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Search positions
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          placeholder="Title or company"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-normal text-zinc-100 focus:border-teal-400 focus:outline-none"
        />
      </label>
      {groups.length === 0 && <p className="text-zinc-400">No position matches that search.</p>}
      {groups.map((g) => (
        <section key={g.family} aria-labelledby={`fam-${g.family}`} className="flex flex-col gap-2">
          <h2 id={`fam-${g.family}`} className="text-sm font-medium tracking-wide text-zinc-400 uppercase">{g.family}</h2>
          <ul className="flex flex-col divide-y divide-zinc-800 rounded-xl border border-zinc-800">
            {g.items.map((p) => <PositionRow key={p.id} p={p} />)}
          </ul>
        </section>
      ))}
    </>
  );
}

export function PositionsView(): React.JSX.Element {
  const { state, submitToken } = useAuthedJson<{ positions: PositionListItem[] }>("/api/positions");
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Positions</h1>
          <p className="text-zinc-400">Pick the position you are hiring for, then research candidates against its must-haves.</p>
        </div>
        {state.kind === "ready" && state.data.positions.length > 0 && <Link href="/positions/new" className={CTA}>Add a position</Link>}
      </header>
      <AuthStates state={state} onToken={submitToken} />
      {state.kind === "ready" && <PositionSections items={state.data.positions} />}
    </main>
  );
}
