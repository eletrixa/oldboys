/**
 * Inline editor for a position's title and role family.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/position-basics.tsx
 * Deps:    react, src/app/ui, src/domain/position, ./save-position
 * Tested:  n/a (covered by e2e/positions.spec.ts)
 *
 * Key responsibilities:
 * - Title input plus family select; Save sends PATCH and reports saved or the error
 *
 * Design constraints:
 * - Client component; family options are the fixed FAMILIES enum
 */
"use client";

import { useState } from "react";
import { FAMILIES, type Family, type Position } from "@/domain/position";
import { BTN_PRIMARY, FIELD } from "@/app/ui";
import { savePosition } from "./save-position";

type PositionBasicsProps = { position: Position; onSaved: (p: Position) => void };

export function PositionBasics({ position, onSaved }: PositionBasicsProps): React.JSX.Element {
  const [draft, setDraft] = useState<{ title: string; family: Family } | null>(null);
  const { title, family } = draft ?? position;
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(): Promise<void> {
    const result = await savePosition(position.id, { title: title.trim(), family });
    if (!result.ok) {
      setMessage({ ok: false, text: result.message });
      return;
    }
    setDraft(null);
    onSaved(result.position);
    setMessage({ ok: true, text: "Saved" });
  }

  return (
    <details className="border-y border-divider py-3">
      <summary className="cursor-pointer text-sm font-medium text-muted">Edit title and family</summary>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Title
          <input className={FIELD} value={title} onChange={(e) => { setDraft({ title: e.target.value, family }); setMessage(null); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Family
          <select className={FIELD} value={family} onChange={(e) => { setDraft({ title, family: e.target.value as Family }); setMessage(null); }}>
            {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button type="button" className={BTN_PRIMARY} disabled={title.trim() === ""} onClick={() => void save()}>
            Save
          </button>
          <span role="status" className={`text-sm ${message?.ok === false ? "text-conflict" : "text-muted"}`}>{message?.text}</span>
        </div>
      </div>
    </details>
  );
}
