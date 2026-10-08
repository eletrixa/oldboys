/**
 * Run page header link for the position a run was started from.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/position-header.ts
 * Deps:    ./state (RunState type)
 * Tested:  src/app/runs/[id]/__tests__/position-header.test.ts
 *
 * Key responsibilities:
 * - positionHeader: {label: "Researched for: <title>", href: "/positions/<id>"} when the state has a position, else null
 *
 * Design constraints:
 * - Pure; the id is URL-encoded so a stray character can never change the path
 */
import type { RunState } from "./state";

export function positionHeader(state: Pick<RunState, "position">): { label: string; href: string } | null {
  const { position } = state;
  return position === null ? null : { label: `Researched for: ${position.title}`, href: `/positions/${encodeURIComponent(position.id)}` };
}
