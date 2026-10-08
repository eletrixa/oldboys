/**
 * LineupForm: pick the right namesake; posts the choice to /api/runs/:id/answer.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/lineup-form.tsx
 * Deps:    react
 * Tested:  n/a (thin client component)
 *
 * Key responsibilities:
 * - Radio list of candidates with anchor evidence and score; one submit
 * - Reload the page after the Workflow accepts the answer
 *
 * Design constraints:
 * - Client component only because it needs fetch on click; no other state
 */
"use client";

import { useState } from "react";
import type { LineupCandidate } from "@/domain/run-status";

export function LineupForm({ runId, candidates }: { runId: string; candidates: LineupCandidate[] }): React.JSX.Element {
  const [picked, setPicked] = useState<string>(candidates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: picked }),
    });
    if (res.ok) {
      window.location.reload();
      return;
    }
    setBusy(false);
    setError(`Could not send the answer (${String(res.status)}).`);
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-amber-700 p-4"
      aria-label="Pick the right person"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-lg font-medium">Which one is it?</h2>
      {candidates.map((c) => (
        <label key={c.id} className="flex items-start gap-3">
          <input type="radio" name="candidate" value={c.id} checked={picked === c.id} onChange={() => { setPicked(c.id); }} />
          <span>
            <span className="font-medium">{c.name}</span>{" "}
            <span className="text-xs text-zinc-500">score {Math.round(c.score * 100)}% · {c.decision}</span>
            {c.anchor_match !== null ? <span className="block text-sm text-zinc-400">{c.anchor_match}</span> : null}
          </span>
        </label>
      ))}
      <button type="submit" disabled={busy || picked.length === 0} className="self-start rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 disabled:opacity-50">
        {busy ? "Sending…" : "Continue research"}
      </button>
      {error !== null ? <p className="text-sm text-red-400">{error}</p> : null}
    </form>
  );
}
