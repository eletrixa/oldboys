/**
 * Start form's position context: loads the public summary for `?positionId=` and shows it read-only.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/start-position.tsx
 * Deps:    react, ./api/positions/[id]/summary/summary (type only)
 * Tested:  n/a (the body builder is tested in src/app/__tests__/start-body.test.ts; the summary route in its own test)
 *
 * Key responsibilities:
 * - usePositionSummary: none | loading | ready {summary} | error, from GET /api/positions/:id/summary (no token)
 * - PositionBanner: "Researching for: <title>" with the must-haves as a read-only list
 *
 * Design constraints:
 * - Client component; no token anywhere; an unknown or failed id yields `error` and the form falls back to the role field
 */
"use client";

import { useEffect, useState } from "react";
import type { PositionSummary } from "./api/positions/[id]/summary/summary";

export type PositionState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; summary: PositionSummary }
  | { status: "error" };

export function usePositionSummary(positionId: string | null): PositionState {
  const [loaded, setLoaded] = useState<{ id: string; result: PositionSummary | null } | null>(null);

  useEffect(() => {
    if (positionId === null) return;
    const abort = new AbortController();
    void (async () => {
      let result: PositionSummary | null = null;
      try {
        const res = await fetch(`/api/positions/${encodeURIComponent(positionId)}/summary`, { cache: "no-store", signal: abort.signal });
        if (res.ok) result = await res.json<PositionSummary>();
      } catch {
        // network error: same outcome as an unknown position
      }
      if (!abort.signal.aborted) setLoaded({ id: positionId, result });
    })();
    return () => {
      abort.abort();
    };
  }, [positionId]);

  if (positionId === null) return { status: "none" };
  if (loaded?.id !== positionId) return { status: "loading" };
  return loaded.result === null ? { status: "error" } : { status: "ready", summary: loaded.result };
}

export function PositionBanner({ summary }: { summary: PositionSummary }): React.JSX.Element {
  return (
    <section aria-label="Position" className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-sm text-zinc-400">
        Researching for: <strong className="font-semibold text-zinc-100">{summary.title}</strong>
      </p>
      {summary.must_haves.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
          {summary.must_haves.map((m) => (
            <li key={m.id}>{m.title !== undefined && m.title !== "" ? `${m.title}: ${m.text}` : m.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
