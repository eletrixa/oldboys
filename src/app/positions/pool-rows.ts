/**
 * Pure helpers for the candidate pool of a position page: row shaping, selection, intake channels, result lines.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/pool-rows.ts
 * Deps:    src/app/api/positions/handler (types), src/app/intake/intake-rows, src/domain/position (kebab)
 * Tested:  src/app/positions/__tests__/pool-rows.test.ts
 *
 * Key responsibilities:
 * - shapePool: PoolRow to display row (labels, tone, selectable flag, presence text)
 * - channelsFor: the four ways a candidate reaches a bound intake tag
 * - defaultTag: tag suggestion from a position title
 * - enrichSummary: one line for the result of Start enrichment
 *
 * Design constraints:
 * - Pure, no I/O, no React
 * - Arrival order only: no score, rank or verdict on a person
 */
import type { PoolRow } from "@/app/api/positions/handler";
import { formatReceived, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, type StatusTone, type TagRow } from "@/app/intake/intake-rows";
import { kebab } from "@/domain/position";

export type PoolView = {
  id: string;
  name: string;
  email: string | null;
  source: string;
  received: string;
  status: string;
  tone: StatusTone;
  presence: string;
  selectable: boolean;
  runHref: string | null;
  note: string | null;
};

/** A pooled row can start a run only when it carries a LinkedIn URL or CV text. */
export function shapePool(rows: readonly PoolRow[]): PoolView[] {
  return rows.map((r) => {
    const parts = [r.has_profile === 1 ? "LinkedIn" : null, r.has_cv === 1 ? "CV" : null].filter((p) => p !== null);
    return {
      id: r.id,
      name: r.name ?? "Unnamed",
      email: r.email,
      source: SOURCE_LABEL[r.source],
      received: formatReceived(r.received_at),
      status: STATUS_LABEL[r.status],
      tone: STATUS_TONE[r.status],
      presence: parts.length === 0 ? "—" : parts.join(" · "),
      selectable: r.status === "pooled" && parts.length > 0,
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
