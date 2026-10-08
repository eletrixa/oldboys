/**
 * Inline editor for a position's must-haves (1..5 items, title and text each).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/must-have-editor.tsx
 * Deps:    react, src/domain/position-links, ./patch-position
 * Tested:  add/remove rules in src/domain/__tests__/position-links.test.ts; view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - Edit text and title, add up to 5, remove down to 1, Save sends PATCH must_haves and reports saved or the error
 *
 * Design constraints:
 * - Client component; accepted_evidence of existing items is kept untouched
 */
"use client";

import { useState } from "react";
import { addMustHave, removeMustHave } from "@/domain/position-links";
import type { MustHave, Position } from "@/domain/position";
import { patchPosition } from "./patch-position";

type MustHaveEditorProps = { position: Position; onSaved: (p: Position) => void };

const FIELD = "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-teal-400 focus:outline-none";
const GHOST = "rounded-xl border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:outline-none disabled:opacity-50";

export function MustHaveEditor({ position, onSaved }: MustHaveEditorProps): React.JSX.Element {
  const [items, setItems] = useState<MustHave[]>(position.must_haves);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  function edit(id: string, patch: Partial<MustHave>): void {
    setItems((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    setStatus({ kind: "idle" });
  }

  async function save(): Promise<void> {
    setStatus({ kind: "saving" });
    const cleaned = items.filter((m) => m.text.trim() !== "").map((m) => ({ ...m, text: m.text.trim(), title: m.title?.trim() === "" ? undefined : m.title?.trim() }));
    const result = await patchPosition(position.id, { must_haves: cleaned });
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    setItems(result.position.must_haves);
    onSaved(result.position);
    setStatus({ kind: "saved" });
  }

  return (
    <section aria-labelledby="mh-heading" className="flex flex-col gap-3">
      <h2 id="mh-heading" className="text-xl font-semibold">Must-haves</h2>
      <ul aria-label="Must-haves" className="flex flex-col gap-3">
        {items.map((m, i) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-xl border border-zinc-800 p-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Title {String(i + 1)}
              <input className={FIELD} value={m.title ?? ""} maxLength={48} onChange={(e) => { edit(m.id, { title: e.target.value }); }} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Must-have {String(i + 1)}
              <textarea className={FIELD} rows={2} value={m.text} onChange={(e) => { edit(m.id, { text: e.target.value }); }} />
            </label>
            <button type="button" className={`${GHOST} self-start`} disabled={items.length <= 1} onClick={() => { setItems((l) => removeMustHave(l, m.id)); setStatus({ kind: "idle" }); }}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={GHOST} disabled={items.length >= 5} onClick={() => { setItems((l) => addMustHave(l, "", "New must-have")); setStatus({ kind: "idle" }); }}>
          Add must-have
        </button>
        <button type="button" className="rounded-xl bg-teal-500 px-4 py-2 font-medium text-zinc-950 hover:bg-teal-400 disabled:opacity-50" disabled={status.kind === "saving"} onClick={() => void save()}>
          Save
        </button>
        <span role="status" className="text-sm text-zinc-400">
          {status.kind === "saved" && "Saved"}
          {status.kind === "error" && <span className="text-red-300">{status.message}</span>}
        </span>
      </div>
    </section>
  );
}
