/**
 * Inline editor for a position's must-haves (1..5 items, title and text each).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/must-have-editor.tsx
 * Deps:    react, src/app/ui, src/domain/position-links, ./save-position
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
import { BTN_PRIMARY, BTN_QUIET, BTN_SECONDARY, FIELD } from "@/app/ui";
import type { MustHave, Position } from "@/domain/position";
import { addMustHave, removeMustHave } from "@/domain/position-links";
import { savePosition } from "./save-position";

type MustHaveEditorProps = { position: Position; onSaved: (p: Position) => void };

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
    const result = await savePosition(position.id, { must_haves: cleaned });
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      return;
    }
    setItems(result.position.must_haves);
    onSaved(result.position);
    setStatus({ kind: "saved" });
  }

  return (
    <section id="must-haves" aria-labelledby="mh-heading" className="flex scroll-mt-6 flex-col gap-3">
      <h2 id="mh-heading" className="font-serif text-2xl">Must-haves</h2>
      <ul aria-label="Must-haves" className="flex flex-col divide-y divide-divider">
        {items.map((m, i) => (
          <li key={m.id} className="flex flex-col gap-2 py-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Title {String(i + 1)}
              <input className={`${FIELD} px-3 py-2`} value={m.title ?? ""} maxLength={48} onChange={(e) => { edit(m.id, { title: e.target.value }); }} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Must-have {String(i + 1)}
              <textarea className={`${FIELD} px-3 py-2`} rows={2} value={m.text} onChange={(e) => { edit(m.id, { text: e.target.value }); }} />
            </label>
            <button type="button" className={`${BTN_QUIET} self-start`} disabled={items.length <= 1} onClick={() => { setItems((l) => removeMustHave(l, m.id)); setStatus({ kind: "idle" }); }}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BTN_SECONDARY} disabled={items.length >= 5} onClick={() => { setItems((l) => addMustHave(l, "", "New must-have")); setStatus({ kind: "idle" }); }}>
          Add must-have
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={status.kind === "saving"} onClick={() => void save()}>
          Save
        </button>
        <span role="status" className="text-sm text-muted">
          {status.kind === "saved" && "Saved"}
          {status.kind === "error" && <span className="text-conflict">{status.message}</span>}
        </span>
      </div>
    </section>
  );
}
