/**
 * Position detail: header, actions, editable must-haves and the coverage table of its runs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/position-detail.tsx
 * Deps:    next/link, src/app/ui, src/domain/position-links, src/app/_components (role-table, auth-states, use-authed-json), ./must-have-editor
 * Tested:  view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - GET /api/positions/:id; show title, company, location, family chip, ingest label
 * - Actions: Research a candidate (primary), Search people on LinkedIn, Open posting
 * - Notes: fallback must-haves (AI was off), "edited by hand"
 * - Coverage table via RoleTable with its disclaimer, or "No candidates researched yet."
 *
 * Design constraints:
 * - Client component; the table never ranks or scores people
 * - External links carry rel="noopener noreferrer"
 */
"use client";

import Link from "next/link";
import { AuthStates } from "@/app/_components/auth-states";
import { RoleTable } from "@/app/_components/role-table";
import { useAuthedJson } from "@/app/_components/use-authed-json";
import type { PositionDetail } from "@/app/api/positions/handler";
import { BTN_PRIMARY, CARD_PEACH, Eyebrow, LINK, Pill } from "@/app/ui";
import { ingestLabel } from "@/domain/position-links";
import { MustHaveEditor } from "./must-have-editor";
import { PositionBasics } from "./position-basics";

const HINT = "Positions are shared by the team, so they need the team token. Kept only in this tab.";

function Body({ detail, onChange }: { detail: PositionDetail; onChange: (d: PositionDetail) => void }): React.JSX.Element {
  const { position, group } = detail;
  const meta = [position.company, position.location, ingestLabel(position.ingest_method)].filter(Boolean).join(" · ");
  const search = `${position.title} ${position.location ?? ""}`.trim();
  function saved(p: PositionDetail["position"]): void {
    onChange({ ...detail, position: p });
  }
  return (
    <>
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Position</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">{position.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="neutral">{position.family}</Pill>
          <span className="text-sm text-muted">{meta}</span>
        </div>
        {position.extraction === "edited" && <p className="text-sm text-muted">edited by hand</p>}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href={`/?positionId=${encodeURIComponent(position.id)}`} className={BTN_PRIMARY}>Research a candidate</Link>
          <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(search)}`} target="_blank" rel="noopener noreferrer" className={LINK}>Search people on LinkedIn</a>
          {position.posting_url !== undefined && (
            <a href={position.posting_url} target="_blank" rel="noopener noreferrer" className={LINK}>Open posting</a>
          )}
        </div>
      </header>
      <PositionBasics position={position} onSaved={saved} />
      {position.extraction === "fallback" && (
        <p className={`${CARD_PEACH} text-sm`}>
          Fallback must-haves (AI was off). Edit them below so the research asks about this role.
        </p>
      )}
      <MustHaveEditor position={position} onSaved={saved} />
      {group === null ? <p className="text-muted">No candidates researched yet.</p> : <RoleTable group={group} />}
    </>
  );
}

export function PositionDetailView({ id }: { id: string }): React.JSX.Element {
  const { state, submitToken, setData } = useAuthedJson<PositionDetail>(`/api/positions/${encodeURIComponent(id)}`);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <Link href="/positions" className="text-sm text-muted hover:text-ink">All positions</Link>
      <AuthStates state={state} onToken={submitToken} hint={HINT} submitLabel="Show positions" back={{ label: "All positions", href: "/positions" }} />
      {state.kind === "ready" && <Body detail={state.data} onChange={setData} />}
    </main>
  );
}
