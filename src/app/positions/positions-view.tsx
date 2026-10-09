/**
 * Positions list: a title-only selector; search, sections per role family, one row per title.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/positions-view.tsx
 * Deps:    react, next/link, src/domain (position, position-links, role-catalog types), src/app/ui, src/app/_components (auth-states, use-authed-json)
 * Tested:  helpers in src/domain/__tests__/position-links.test.ts; view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - GET /api/positions with the stored token; rows = titleChoices(catalog, positions): the team's ingested positions
 *   (link to their page, run count) and the 170 preselected catalog titles (link to the start form with the role prefilled)
 * - Group by family, filter by title client-side; the company is never shown
 *
 * Design constraints:
 * - Client component; no request without a token; `catalog` comes from the server page (title, family, aliases only)
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthStates } from "@/app/_components/auth-states";
import { useAuthedJson } from "@/app/_components/use-authed-json";
import { BTN_PRIMARY, Eyebrow, FIELD, LINK } from "@/app/ui";
import type { PositionListItem } from "@/domain/position";
import { filterTitles, groupByFamily, indexTitles, type TitleChoice, titleChoices } from "@/domain/position-links";
import type { RoleOption } from "@/domain/role-catalog";

const HINT = "Positions are shared by the team, so they need the team token. Kept only in this tab.";

function TitleRow({ c }: { c: TitleChoice }): React.JSX.Element {
  const meta = c.runs === null ? "Preselected role" : `${String(c.runs)} ${c.runs === 1 ? "run" : "runs"}`;
  return (
    <li className="-mx-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-3 hover:bg-sage/40">
      <div className="flex min-w-0 flex-col">
        <Link href={c.href} className="font-serif text-xl hover:text-action">
          {c.title}
        </Link>
        <span className="text-sm text-muted">{meta}</span>
      </div>
      {c.posting_url !== null && (
        <a href={c.posting_url} target="_blank" rel="noopener noreferrer" className={`${LINK} text-sm`}>
          Open posting
        </a>
      )}
    </li>
  );
}

function TitleSections({ rows }: { rows: TitleChoice[] }): React.JSX.Element {
  const [query, setQuery] = useState("");
  const index = useMemo(() => indexTitles(rows), [rows]);
  const groups = useMemo(() => groupByFamily(filterTitles(index, query)), [index, query]);
  return (
    <>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Search {String(rows.length)} positions
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          placeholder="Title"
          className={`${FIELD} font-normal`}
        />
      </label>
      {groups.length === 0 && <p className="text-muted">No position matches that search.</p>}
      {groups.map((g) => (
        <section key={g.family} aria-labelledby={`fam-${g.family}`} className="flex flex-col gap-2">
          <h2 id={`fam-${g.family}`} className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{g.family}</h2>
          <ul className="flex flex-col divide-y divide-divider">
            {g.items.map((c) => <TitleRow key={c.href} c={c} />)}
          </ul>
        </section>
      ))}
    </>
  );
}

export function PositionsView({ catalog }: { catalog: readonly RoleOption[] }): React.JSX.Element {
  const { state, submitToken } = useAuthedJson<{ positions: PositionListItem[] }>("/api/positions");
  const rows = useMemo(() => (state.kind === "ready" ? titleChoices(catalog, state.data.positions) : []), [catalog, state]);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Positions</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Pick a position</h1>
        <p className="text-muted">Pick the title you are hiring for, then give us the candidate. Your own postings come first, the preselected roles follow.</p>
        {state.kind === "ready" && <Link href="/positions/new" className={BTN_PRIMARY}>Add a position from a posting</Link>}
      </header>
      <AuthStates state={state} onToken={submitToken} hint={HINT} submitLabel="Show positions" />
      {state.kind === "ready" && <TitleSections rows={rows} />}
    </main>
  );
}
