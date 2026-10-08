/**
 * Position detail: header, actions, editable must-haves and the coverage table of its runs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/position-detail.tsx
 * Deps:    react, next/link, src/domain/position-links, src/app/_components/role-table, ./must-have-editor
 * Tested:  helpers in src/domain/__tests__/position-links.test.ts; view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - GET /api/positions/:id; show title, company, location, family chip, ingest label
 * - Actions: Open posting, Search people on LinkedIn, Research a candidate
 * - Coverage table via RoleTable with its disclaimer, or "No candidates researched yet."
 *
 * Design constraints:
 * - Client component; the table never ranks or scores people
 * - External links carry rel="noopener noreferrer"
 */
"use client";

import Link from "next/link";
import { RoleTable } from "@/app/_components/role-table";
import type { PositionDetail } from "@/app/api/positions/handler";
import { ingestLabel, linkedinPeopleSearchUrl, researchHref } from "@/domain/position-links";
import { AuthStates } from "./auth-states";
import { MustHaveEditor } from "./must-have-editor";
import { PositionBasics } from "./position-basics";
import { useAuthedJson } from "./use-authed-json";

const LINK = "text-teal-300 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none";

function Body({ detail, onChange }: { detail: PositionDetail; onChange: (d: PositionDetail) => void }): React.JSX.Element {
  const { position, group } = detail;
  const meta = [position.company, position.location].filter(Boolean).join(" · ");
  function saved(p: PositionDetail["position"]): void {
    onChange({ ...detail, position: p });
  }
  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{position.title}</h1>
          <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-300">{position.family}</span>
          <span className="text-xs text-zinc-500">{ingestLabel(position.ingest_method)}</span>
        </div>
        {meta !== "" && <p className="text-zinc-400">{meta}</p>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={researchHref(position.id)} className="rounded-xl bg-teal-500 px-4 py-2 font-medium text-zinc-950 hover:bg-teal-400">Research a candidate</Link>
          <a href={linkedinPeopleSearchUrl(position.title, position.location)} target="_blank" rel="noopener noreferrer" className={LINK}>Search people on LinkedIn</a>
          {position.posting_url !== undefined && (
            <a href={position.posting_url} target="_blank" rel="noopener noreferrer" className={LINK}>Open posting</a>
          )}
        </div>
      </header>
      <PositionBasics key={position.title + position.family} position={position} onSaved={saved} />
      {position.extraction === "fallback" && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
          Fallback must-haves (AI was off). Edit them below so the research asks about this role.
        </p>
      )}
      <MustHaveEditor position={position} onSaved={saved} />
      {group === null ? <p className="text-zinc-400">No candidates researched yet.</p> : <RoleTable group={group} />}
    </>
  );
}

export function PositionDetailView({ id }: { id: string }): React.JSX.Element {
  const { state, submitToken, setData } = useAuthedJson<PositionDetail>(`/api/positions/${encodeURIComponent(id)}`);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <Link href="/positions" className="text-sm text-zinc-400 hover:text-zinc-200">All positions</Link>
      <AuthStates state={state} onToken={submitToken} />
      {state.kind === "ready" && <Body detail={state.data} onChange={setData} />}
    </main>
  );
}
