/**
 * Pure helpers for the candidate pool of a position page: row shaping, selection, intake channels, result lines.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/pool-rows.ts
 * Deps:    src/app/api/positions/handler (types), src/app/intake/intake-rows, src/domain/position (kebab)
 * Tested:  src/app/positions/__tests__/pool-rows.test.ts
 *
 * Key responsibilities:
 * - shapePool: PoolRow to results-table row in added order (candidateName, candidateSource, candidateStatus with run
 *   progress, fit % and independent-evidence count once done, selectable flag)
 * - channelsFor: the four ways a candidate reaches a bound intake tag
 * - defaultTag: tag suggestion from a position title
 * - enrichSummary: one line for the result of Start enrichment
 *
 * Design constraints:
 * - Pure, no I/O, no React
 * - Arrival order only: no score, rank or verdict on a person
 */
import type { PoolRow } from "@/app/api/positions/handler";
import { STATUS_LABEL, STATUS_TONE, type StatusTone, type TagRow } from "@/app/intake/intake-rows";
import { kebab } from "@/domain/position";

export type PoolView = {
  id: string;
  name: string;
  email: string | null;
  source: string;
  status: string;
  tone: StatusTone;
  /** True while the run can still change (queued, running, paused): the page polls. */
  researching: boolean;
  fit: string;
  independent: string;
  selectable: boolean;
  runHref: string | null;
  note: string | null;
};

const INTAKE_SOURCES: ReadonlySet<PoolRow["source"]> = new Set(["email", "form", "apply-page", "startupjobs"]);

/** Application name, else the run's derived subject, else the LinkedIn handle, else "CV candidate". */
export function candidateName(r: PoolRow): string {
  const subject = r.run?.subject.trim() ?? "";
  return r.name ?? (subject !== "" ? subject : (r.handle ?? "CV candidate"));
}

/** Intake when a channel brought the person in; otherwise what was added by hand. */
export function candidateSource(r: PoolRow): string {
  if (INTAKE_SOURCES.has(r.source)) return "Intake";
  if (r.has_profile === 1) return "LinkedIn";
  return r.has_cv === 1 ? "CV" : "Pool";
}

export function candidateStatus(r: PoolRow): { label: string; tone: StatusTone; researching: boolean } {
  const run = r.run;
  if (run === null) return { label: r.status === "pooled" ? "Pooled" : STATUS_LABEL[r.status], tone: STATUS_TONE[r.status], researching: false };
  if (run.status === "done") return { label: "Done", tone: "ok", researching: false };
  if (run.status === "failed") return { label: "Failed", tone: "conflict", researching: false };
  if (run.stalled) return { label: "Stalled, start again", tone: "unsure", researching: false };
  if (run.status === "paused") return { label: "Paused, open the profile to answer", tone: "unsure", researching: true };
  const label = ["Researching", run.step, `${String(run.pct)}%`].filter((p) => p !== null).join(" · ");
  return { label, tone: "unsure", researching: true };
}

/**
 * Rows in added order (the API sends newest first). Fit % and the independent count show only for a done run.
 * A pooled row can start a run only when it carries a LinkedIn URL or CV text.
 */
export function shapePool(rows: readonly PoolRow[]): PoolView[] {
  return [...rows].reverse().map((r) => {
    const { label, tone, researching } = candidateStatus(r);
    const done = r.run?.status === "done";
    return {
      id: r.id,
      name: candidateName(r),
      email: r.email,
      source: candidateSource(r),
      status: label,
      tone,
      researching,
      fit: done && r.run !== null && r.run.fit_pct !== null ? `${String(r.run.fit_pct)}%` : "—",
      independent: done ? String(r.run?.independent ?? 0) : "—",
      selectable: r.status === "pooled" && (r.has_profile === 1 || r.has_cv === 1),
      runHref: r.run_id === null ? null : `/runs/${encodeURIComponent(r.run_id)}`,
      note: r.note,
    };
  });
}

export type Channel = { label: string; value: string };

export function channelsFor(tag: TagRow, origin: string): Channel[] {
  return [
    { label: "Email", value: `jobs+${tag.tag}@asajj.cz` },
    { label: "Apply page", value: `${origin}/apply/${tag.tag}` },
    { label: "Google Form hidden field tag", value: tag.tag },
    { label: "StartupJobs offer", value: tag.startupjobs_offer_id ?? "not mapped" },
  ];
}

/** Tag suggestion that fits the IntakeTag pattern (2..40 chars, a-z0-9 and dashes). */
export function defaultTag(title: string): string {
  return kebab(title).slice(0, 40).replace(/-+$/, "");
}

export type EnrichResponse = {
  started: readonly { applicationId: string; runId: string }[];
  skipped: readonly { applicationId: string; reason: string }[];
};

export function enrichSummary(body: EnrichResponse): string {
  const n = body.started.length;
  const head = `Started ${String(n)} ${n === 1 ? "run" : "runs"}`;
  if (body.skipped.length === 0) return head;
  const reasons = [...new Set(body.skipped.map((s) => s.reason))].join("; ");
  return `${head}. Skipped ${String(body.skipped.length)}: ${reasons}`;
}
