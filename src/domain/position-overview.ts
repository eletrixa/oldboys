/**
 * Candidates overview of one position: the runs started from a position, laid out per must-have.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/position-overview.ts
 * Deps:    src/domain/role-overview.ts
 * Tested:  src/domain/__tests__/position-overview.test.ts
 *
 * Key responsibilities:
 * - positionOverview: one RoleGroup with key = position id and role = position title, built by the shared group builder
 *
 * Design constraints:
 * - Pure; rows are already the position's runs (selected by position_id), the free-text role is ignored
 * - Same rule as role-overview: rates evidence, never the person; no score, runs newest first
 */
import { buildGroup, type RoleGroup, type RoleRunRow } from "@/domain/role-overview";

/** Null when the position has no runs. */
export function positionOverview(rows: readonly RoleRunRow[], position: { id: string; title: string }): RoleGroup | null {
  if (rows.length === 0) return null;
  return { ...buildGroup(position.id, [...rows]), role: position.title };
}
