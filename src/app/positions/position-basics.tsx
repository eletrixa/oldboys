/**
 * Inline editor for a position's title and role family.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/position-basics.tsx
 * Deps:    react, src/domain/position, ./patch-position
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
import { patchPosition } from "./patch-position";

type PositionBasicsProps = { position: Position; onSaved: (p: Position) => void };

const FIELD = "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-teal-400 focus:outline-none";

export function PositionBasics({ position, onSaved }: PositionBasicsProps): React.JSX.Element {
  const [title, setTitle] = useState(position.title);
  const [family, setFamily] = useState<Family>(position.family);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(): Promise<void> {
    const result = await patchPosition(position.id, { title: title.trim(), family });
    if (!result.ok) {
      setMessage({ ok: false, text: result.message });
      return;
    }
    onSaved(result.position);
    setMessage({ ok: true, text: "Saved" });
  }

  return (
    <details className="rounded-xl border border-zinc-800 px-3 py-2">
      <summary className="cursor-pointer text-sm text-zinc-300 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none">Edit title and family</summary>
      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Title
          <input className={FIELD} value={title} onChange={(e) => { setTitle(e.target.value); setMessage(null); }} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Family
          <select className={FIELD} value={family} onChange={(e) => { setFamily(e.target.value as Family); setMessage(null); }}>
            {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button type="button" className="rounded-xl bg-teal-500 px-4 py-2 font-medium text-zinc-950 hover:bg-teal-400 disabled:opacity-50" disabled={title.trim() === ""} onClick={() => void save()}>
            Save
          </button>
          <span role="status" className={`text-sm ${message?.ok === false ? "text-red-300" : "text-zinc-400"}`}>{message?.text}</span>
        </div>
      </div>
    </details>
  );
}
