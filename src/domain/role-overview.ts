/**
 * Candidates overview per role: groups hiring runs by role text and lays out evidence coverage per must-have.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-overview.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/role-overview.test.ts
 *
 * Key responsibilities:
 * - roleKey: normalized role text (trimmed, inner whitespace collapsed, lower case) = the group key
 * - roleOverview: groups rows by roleKey; columns = union of the runs' must-have (mh-) questions matched by text;
 *   cell = coverage label from the stored brief ("not checked" when the brief is missing, degraded or silent)
 * - sources_confirmed = count of identity-merged sources only (namesake hits never counted)
 * - subject: NO_NAME_YET while a profile-first run has not read the name yet (the person cell is never blank)
 *
 * Design constraints:
 * - Pure: JSON columns are parsed defensively here, no I/O
 * - Rates the evidence the research found, never the person: no total score, no ranking; runs newest first,
 *   groups by most recent run, never by coverage
 */

/** One investigation as read by GET /api/roles (JSON columns raw from D1). */
export type RoleRunRow = {
  id: string;
  subject: string;
  role: string | null;
  status: string;
  created_at: string;
  questions_json: string | null;
  brief_json: string | null;
  sources_confirmed: number;
  /** Last recipe step with a ledger row; read by the position results table only. */
  last_step?: string | null;
  /** ts of the newest ledger row (any step), else created_at; read by the stalled display state. */
  last_at?: string | null;
};

export const COVERAGE_LABELS = ["documented", "partial", "no evidence", "not checked"] as const;
export type CoverageLabel = (typeof COVERAGE_LABELS)[number];

export type RoleOverviewRun = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  sources_confirmed: number;
  /** One label per entry of the group's `questions`, same order. */
  cells: CoverageLabel[];
};

export type RoleGroup = {
  key: string;
  /** Role text as typed on the most recent run. */
  role: string;
  run_count: number;
  questions: string[];
  runs: RoleOverviewRun[];
};

/** Person cell text before a profile-first run has read the candidate's name from the profile. */
export const NO_NAME_YET = "Name not read yet";

const LABEL_BY_COVERAGE: Readonly<Record<string, CoverageLabel>> = {
  evidenced: "documented",
  partial: "partial",
  none: "no evidence",
};

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function roleKey(role: string): string {
  return normalize(role);
}

function parseJson(json: string | null): unknown {
  if (json === null || json === "") return null;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Must-have questions (id "mh-") of one run; base research prompts are not role criteria. */
function mustHaves(json: string | null): { id: string; text: string }[] {
  const value = parseJson(json);
  if (!Array.isArray(value)) return [];
  return value.flatMap((q: unknown) =>
    isRecord(q) && typeof q.id === "string" && typeof q.text === "string" && q.id.startsWith("mh-") && q.text.trim() !== ""
      ? [{ id: q.id, text: q.text.trim() }]
      : [],
  );
}

/** question_id → label from a stored brief; null when there is no usable (non-degraded) brief. */
function coverageById(json: string | null): Map<string, CoverageLabel> | null {
  const brief = parseJson(json);
  if (!isRecord(brief) || !Array.isArray(brief.per_question)) return null;
  if (typeof brief.degraded === "string" && brief.degraded !== "") return null;
  const map = new Map<string, CoverageLabel>();
  for (const pq of brief.per_question as unknown[]) {
    if (!isRecord(pq) || typeof pq.question_id !== "string" || typeof pq.coverage !== "string") continue;
    const label = LABEL_BY_COVERAGE[pq.coverage];
    if (label !== undefined) map.set(pq.question_id, label);
  }
  return map;
}

function byNewest(a: { created_at: string }, b: { created_at: string }): number {
  return b.created_at.localeCompare(a.created_at);
}

export function buildGroup(key: string, rows: RoleRunRow[]): RoleGroup {
  const sorted = [...rows].sort(byNewest);
  const columns = new Map<string, string>();
  for (const row of sorted) {
    for (const q of mustHaves(row.questions_json)) {
      const k = normalize(q.text);
      if (!columns.has(k)) columns.set(k, q.text);
    }
  }
  const columnKeys = [...columns.keys()];

  const runs = sorted.map((row): RoleOverviewRun => {
    const coverage = coverageById(row.brief_json);
    const idByText = new Map(mustHaves(row.questions_json).map((q) => [normalize(q.text), q.id]));
    return {
      id: row.id,
      subject: row.subject.trim() === "" ? NO_NAME_YET : row.subject,
      status: row.status,
      created_at: row.created_at,
      sources_confirmed: Math.max(0, Math.trunc(row.sources_confirmed)),
      cells: columnKeys.map((k) => {
        const id = idByText.get(k);
        return id === undefined || coverage === null ? "not checked" : (coverage.get(id) ?? "not checked");
      }),
    };
  });

  return {
    key,
    role: sorted[0]?.role?.trim() ?? key,
    run_count: runs.length,
    questions: [...columns.values()],
    runs,
  };
}

/** Groups runs by normalized role text; groups ordered by their most recent run, runs newest first. */
export function roleOverview(rows: readonly RoleRunRow[]): RoleGroup[] {
  const groups = new Map<string, RoleRunRow[]>();
  for (const row of rows) {
    if (row.role === null || row.role.trim() === "") continue;
    const key = roleKey(row.role);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => buildGroup(key, list))
    .sort((a, b) => byNewest(a.runs[0] ?? { created_at: "" }, b.runs[0] ?? { created_at: "" }));
}
