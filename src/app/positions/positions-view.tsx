/**
 * Positions list: search, sections per role family, one card per position.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/positions-view.tsx
 * Deps:    react, next/link, src/domain (position, position-links), src/app/ui, src/app/_components (auth-states, use-authed-json)
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
import { AuthStates } from "@/app/_components/auth-states";
import { useAuthedJson } from "@/app/_components/use-authed-json";
import { BTN_PRIMARY, Eyebrow, FIELD, LINK } from "@/app/ui";
import type { PositionListItem } from "@/domain/position";
import { filterPositions, groupByFamily, indexPositions, ingestLabel } from "@/domain/position-links";

const HINT = "Positions are shared by the team, so they need the team token. Kept only in this tab.";

function PositionRow({ p }: { p: PositionListItem }): React.JSX.Element {
  const meta = [p.company, p.location, `${String(p.runs)} ${p.runs === 1 ? "run" : "runs"}`, ingestLabel(p.ingest_method)].filter(Boolean);
  return (
    <li className="-mx-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-4 hover:bg-sage/40">
      <div className="flex min-w-0 flex-col">
        <Link href={`/positions/${encodeURIComponent(p.id)}`} className="font-serif text-xl hover:text-action">
          {p.title}
        </Link>
        <span className="text-sm text-muted">{meta.join(" · ")}</span>
      </div>
      {p.posting_url !== null && (
        <a href={p.posting_url} target="_blank" rel="noopener noreferrer" className={`${LINK} text-sm`}>
          Open posting
        </a>
      )}
    </li>
  );
}

function PositionSections({ items }: { items: PositionListItem[] }): React.JSX.Element {
  const [query, setQuery] = useState("");
  const index = useMemo(() => indexPositions(items), [items]);
  const groups = useMemo(() => groupByFamily(filterPositions(index, query)), [index, query]);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted">No positions yet. Add one from its posting and start researching candidates against it.</p>
        <Link href="/positions/new" className={BTN_PRIMARY}>Add a position</Link>
      </div>
    );
  }
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Search positions
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          placeholder="Title or company"
          className={`${FIELD} font-normal`}
        />
      </label>
      {groups.length === 0 && <p className="text-muted">No position matches that search.</p>}
      {groups.map((g) => (
        <section key={g.family} aria-labelledby={`fam-${g.family}`} className="flex flex-col gap-2">
          <h2 id={`fam-${g.family}`} className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{g.family}</h2>
          <ul className="flex flex-col divide-y divide-divider">
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
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Positions</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Pick a position</h1>
        <p className="text-muted">Pick the position you are hiring for, then research candidates against its must-haves.</p>
        {state.kind === "ready" && state.data.positions.length > 0 && <Link href="/positions/new" className={BTN_PRIMARY}>Add a position</Link>}
      </header>
      <AuthStates state={state} onToken={submitToken} hint={HINT} submitLabel="Show positions" />
      {state.kind === "ready" && <PositionSections items={state.data.positions} />}
    </main>
  );
}
