/**
 * New brief step 2: one row per new candidate (LinkedIn profile, pasted CV or CV file) and checkboxes for people already in the pool.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/new/candidates-step.tsx
 * Deps:    react, src/app/{ui,profile-picker}, src/app/positions/pool-rows (shapePool), src/app/api/positions/handler (PoolRow type), ./brief-rows
 * Tested:  helpers in src/app/briefs/new/__tests__/brief-rows.test.ts; view by e2e/brief-flow.spec.ts
 *
 * Key responsibilities:
 * - Rows: visible Candidate N label, source radios, the matching field, Remove (when more than one row), Add another candidate
 * - Pool: only rows that can start (pooled, with a profile or CV) get a checkbox; order = arrival
 *
 * Design constraints:
 * - Client component; state lives in the wizard; a CV file is sent as a file (the server extracts PDF text), never parsed here
 * - No ranking, score or verdict on a person
 */
"use client";

import { useCallback } from "react";
import { ProfilePicker } from "@/app/profile-picker";
import type { PoolRow } from "@/app/api/positions/handler";
import { shapePool } from "@/app/positions/pool-rows";
import { BTN_QUIET, BTN_SECONDARY, CARD_MUTED, FIELD, KEY, Pill } from "@/app/ui";
import type { DraftRow, RowSource } from "./brief-rows";

const SOURCES: readonly (readonly [RowSource, string])[] = [
  ["linkedin", "LinkedIn"],
  ["cv", "Paste CV"],
  ["file", "CV file"],
];
const TAB = "inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-action";
const TAB_ON = `${TAB} bg-ink text-white`;
const TAB_OFF = `${TAB} text-muted hover:bg-sage/60 hover:text-ink`;

type Patch = (key: string, patch: Partial<Omit<DraftRow, "key">>) => void;

function Row({ row, n, onPatch, onRemove }: { row: DraftRow; n: number; onPatch: Patch; onRemove: (() => void) | null }): React.JSX.Element {
  const onUrl = useCallback((url: string) => { onPatch(row.key, { linkedinUrl: url }); }, [onPatch, row.key]);
  return (
    <li className={`${CARD_MUTED} flex flex-col gap-3`} aria-label={`Candidate ${String(n)}`}>
      <span className={KEY}>Candidate {n}</span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset className="flex gap-1 rounded-full border border-line bg-surface p-1">
          <legend className="sr-only">How to add candidate {n}</legend>
          {SOURCES.map(([source, label]) => (
            <label key={source} className={row.source === source ? TAB_ON : TAB_OFF}>
              <input type="radio" name={`source-${row.key}`} className="sr-only" checked={row.source === source} onChange={() => { onPatch(row.key, { source }); }} />
              {label}
            </label>
          ))}
        </fieldset>
        {onRemove !== null && <button type="button" className={BTN_QUIET} onClick={onRemove}>Remove</button>}
      </div>
      {row.source === "linkedin" && <ProfilePicker onUrl={onUrl} />}
      {row.source === "cv" && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          CV text
          <textarea className={FIELD} rows={5} value={row.cvText} placeholder="Paste the CV" onChange={(e) => { onPatch(row.key, { cvText: e.target.value }); }} />
        </label>
      )}
      {row.source === "file" && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          CV file (PDF or text, up to 10 MB)
          <input className="text-sm" type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(e) => { onPatch(row.key, { file: e.target.files?.[0] ?? null }); }} />
        </label>
      )}
    </li>
  );
}

type Props = {
  rows: readonly DraftRow[];
  pool: readonly PoolRow[];
  ticked: ReadonlySet<string>;
  onPatch: Patch;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onTick: (id: string) => void;
};

export function CandidatesStep({ rows, pool, ticked, onPatch, onAdd, onRemove, onTick }: Props): React.JSX.Element {
  const views = shapePool(pool).filter((v) => v.selectable);
  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <Row key={row.key} row={row} n={i + 1} onPatch={onPatch} onRemove={rows.length > 1 ? () => { onRemove(row.key); } : null} />
        ))}
      </ol>
      <button type="button" className={`${BTN_SECONDARY} self-start`} onClick={onAdd}>Add another candidate</button>
      {views.length > 0 && (
        <fieldset className="flex flex-col gap-2 border-t border-divider pt-5">
          <legend className="pb-2 font-semibold">Already in this position&apos;s pool</legend>
          {views.map((v) => (
            <label key={v.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={ticked.has(v.id)} onChange={() => { onTick(v.id); }} />
              <span className="font-medium">{v.name}</span>
              <span className="text-muted">{v.source}</span>
              <Pill tone={v.tone}>{v.status}</Pill>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
