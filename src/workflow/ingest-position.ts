/**
 * Position ingest: a pasted posting or a posting URL becomes one stored `positions` row with at most 5 editable must-haves.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/ingest-position.ts
 * Deps:    D1Database, R2Bucket (passed in), src/recipe/seams/{posting-plan,posting-parse,posting-jobscz-widget,posting-strip,position-extract}, src/domain/audit (RETENTION_DAYS), src/domain/position (errorMessage, fallbackMustHaves), src/domain/role-catalog (ROLE_CATALOG), src/adapters/fetch (UA, TIMEOUT_MS)
 * Tested:  src/workflow/__tests__/ingest-position.test.ts
 *
 * Key responsibilities:
 * - Order: fetch plan, dedupe on (board, external_id), resolve text (fetch with a 20 s abort, parse, paste fallback), strip boilerplate, one capped LLM extract, then insert and R2 put together
 * - Paste always works: a failed fetch falls back to the pasted text with a note, a failed LLM or R2 put never fails the ingest
 * - Jobs.cz career sites (`<company>.jobs.cz`) carry no posting in the HTML: the widget chain of `posting-jobscz-widget` is tried before giving up
 * - Manual entry (title alone, optional company and location, no text): method `manual`, no LLM call; a role-catalog title gets the
 *   template's family and must-haves (extraction `edited`), any other title the generic must-haves
 * - A lost insert (UNIQUE race) deletes the R2 object written in parallel, so no orphan remains
 * - Records the single LLM call's cost in `ingest_cost_usd`; the raw payload goes to R2 `positions/<id>.json` and is purged with the row
 *
 * Design constraints:
 * - No paid actor call, no Next.js import; fetch, clock, ids and the cost estimate are injected
 * - `board` and `external_id` are stored only when the fetch path actually served the text, so a failed fetch never pins a degraded row as the dedupe hit
 * - A session's posting reuses only its own organization's row; when another organization already holds (board, external_id),
 *   the new row is stored without `external_id` (the unique index stays global), so it is never handed to the other one
 */
import { TIMEOUT_MS, UA } from "@/adapters/fetch";
import type { CreatePositionBody } from "@/app/api/_lib/position-body";
import { RETENTION_DAYS } from "@/domain/audit";
import type { Ports } from "@/domain/ports";
import { errorMessage, fallbackMustHaves } from "@/domain/position";
import { ROLE_CATALOG } from "@/domain/role-catalog";
import { type ExtractedPosition, extractPosition, familyOf } from "@/recipe/seams/position-extract";
import { fetchJobsCzWidget } from "@/recipe/seams/posting-jobscz-widget";
import { parsePosting, type ParsedPosting } from "@/recipe/seams/posting-parse";
import { type PostingMethod, postingFetchPlan } from "@/recipe/seams/posting-plan";
import { stripBoilerplate } from "@/recipe/seams/posting-strip";

const MIN_FETCHED_CHARS = 200;
const MAX_TEXT_CHARS = 20_000;
const MAX_RAW_CHARS = 500_000;
const EXCERPT_CHARS = 1000;
const DEFAULT_CAP_USD = 0.05;
const DAY_MS = 24 * 60 * 60 * 1000;

export type IngestDeps = {
  db: D1Database;
  bucket: R2Bucket;
  ports: Pick<Ports, "llm">;
  fetchFn: typeof fetch;
  now: Date;
  newId: () => string;
  capUsd: number;
  estimateUsd: (text: string) => number;
  /** The creating session's organization, stored on the row; null or absent = bearer (NULL owner, reuse across all rows as before). */
  organizationId?: string | null;
};
export type IngestResult = { ok: true; id: string; reused: boolean; notes: string[] } | { ok: false; status: 422; error: string };

/** Chars / 4 tokens at a conservative $5 per million input tokens, plus 800 output tokens at $20 per million. */
export const estimatePositionUsd = (text: string): number => (text.length / 4) * (5 / 1_000_000) + 800 * (20 / 1_000_000);

/** `POSITION_INGEST_USD` var to a USD cap; unset or not a positive number gives the default. */
export function ingestCapUsd(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP_USD;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const init = (): RequestInit => ({ signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": UA } });

/** Body and final URL (after redirects; the request URL when the response carries none). */
async function fetchPage(fetchFn: typeof fetch, url: string): Promise<{ body: string; url: string }> {
  const res = await fetchFn(url, init());
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  return { body: await res.text(), url: res.url === "" ? url : res.url };
}

type Resolved = { ok: true; method: PostingMethod; parsed: ParsedPosting; raw: string; notes: string[] } | { ok: false; error: string };

/** The fetch path when the plan has one, else (or when it fails and text was pasted) the pasted text; a bare title is a manual entry. */
async function resolveText(fetchFn: typeof fetch, plan: ReturnType<typeof postingFetchPlan>, pasted: string, manual: boolean): Promise<Resolved> {
  const paste: Resolved = { ok: true, method: "pasted", parsed: { text: pasted }, raw: pasted, notes: [] };
  if (!plan.request) {
    if (pasted !== "") return paste;
    if (manual) return { ok: true, method: "manual", parsed: { text: "" }, raw: "", notes: [] };
    return { ok: false, error: "no posting text and the URL cannot be fetched; paste the posting text instead" };
  }
  try {
    const page = await fetchPage(fetchFn, plan.request.url);
    let parsed = parsePosting(plan.method, page.body, plan.externalId);
    let raw = page.body;
    if (plan.method === "jobs-cz" && parsed.text.length < MIN_FETCHED_CHARS) {
      ({ parsed, raw } = await fetchJobsCzWidget(fetchFn, { html: page.body, url: page.url }, plan.externalId ?? "", init()));
    }
    if (parsed.text.length < MIN_FETCHED_CHARS) throw new Error("posting text not found in the response");
    return { ok: true, method: plan.method, parsed, raw, notes: [] };
  } catch (e) {
    if (pasted === "") {
      return { ok: false, error: `could not read the posting at ${hostOf(plan.request.url)}: ${errorMessage(e)}; paste the posting text instead` };
    }
    return { ...paste, notes: [`fetch via ${plan.method} failed (${errorMessage(e)}), used the pasted text`] };
  }
}

type Hint = { title?: string; company?: string; location?: string };

/** One capped LLM extract; manual entries and texts over the cap get the generic must-haves without a call. */
async function extractOrGeneric(deps: IngestDeps, method: PostingMethod, text: string, hint: Hint, notes: string[]): Promise<Omit<ExtractedPosition, "extraction"> & { extraction: ExtractedPosition["extraction"] | "edited" }> {
  if (method === "manual") {
    const title = hint.title ?? "";
    // A role-catalog title (the New brief picker) brings its curated must-haves; those count as hand-made, not generic.
    const template = ROLE_CATALOG.find((t) => t.title === title);
    return {
      title,
      ...(hint.company !== undefined ? { company: hint.company } : {}),
      ...(hint.location !== undefined ? { location: hint.location } : {}),
      family: template?.family ?? familyOf(title),
      must_haves: template?.must_haves ?? fallbackMustHaves(title, hint.location ?? null),
      extraction: template === undefined ? "fallback" : "edited",
      cost_usd: 0,
      notes: [],
    };
  }
  const overCap = deps.estimateUsd(text) > deps.capUsd;
  const ports = overCap ? { llm: () => Promise.reject(new Error("over cap")) } : deps.ports;
  const extracted = await extractPosition(text, ports, hint);
  notes.push(...(overCap ? ["position extract: estimated cost over POSITION_INGEST_USD, used generic fallback"] : extracted.notes));
  return extracted;
}

const existingId = (db: D1Database, board: string, externalId: string) =>
  db.prepare("SELECT id, organization_id FROM positions WHERE board = ? AND external_id = ?").bind(board, externalId).first<{ id: string; organization_id: string | null }>();

/** The bearer reuses any row; a session only its own organization's. */
const reusable = (hit: { organization_id: string | null } | null, organizationId: string | null): boolean =>
  hit !== null && (organizationId === null || hit.organization_id === organizationId);

export async function ingestPosition(deps: IngestDeps, body: CreatePositionBody): Promise<IngestResult> {
  const { db, bucket, now } = deps;
  const organizationId = deps.organizationId ?? null;
  const plan = postingFetchPlan(body.postingUrl ?? null);
  const pasted = body.postingText?.trim() ?? "";

  let takenElsewhere = false;
  if (plan.board !== undefined && plan.externalId !== undefined) {
    const hit = await existingId(db, plan.board, plan.externalId);
    if (hit && reusable(hit, organizationId)) return { ok: true, id: hit.id, reused: true, notes: [] };
    takenElsewhere = hit !== null;
  }

  const resolved = await resolveText(deps.fetchFn, plan, pasted, body.title !== undefined);
  if (!resolved.ok) return { ok: false, status: 422, error: resolved.error };
  const { method, parsed, raw, notes } = resolved;
  const fetchedAt = now.toISOString();

  const stripped = stripBoilerplate(parsed.text).trim();
  const text = (stripped === "" ? parsed.text : stripped).slice(0, MAX_TEXT_CHARS);
  const hint = { title: body.title ?? parsed.title, company: body.company ?? parsed.company, location: body.location ?? parsed.location };
  const extracted = await extractOrGeneric(deps, method, text, hint, notes);

  const id = deps.newId();
  const r2Key = `positions/${id}.json`;
  const served = method === "pasted" || method === "manual" ? undefined : plan;
  const insert = db
    .prepare(
      `INSERT INTO positions (id, title, family, company, location, board, posting_url, external_id, must_haves_json, excerpt, r2_key, ingest_method, ingest_cost_usd, created_at, expires_at, extraction, organization_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      extracted.title,
      extracted.family,
      extracted.company ?? null,
      extracted.location ?? null,
      served?.board ?? null,
      plan.request ? (body.postingUrl ?? null) : null,
      takenElsewhere ? null : (served?.externalId ?? null),
      JSON.stringify(extracted.must_haves),
      text.slice(0, EXCERPT_CHARS),
      r2Key,
      method,
      extracted.cost_usd,
      fetchedAt,
      new Date(now.getTime() + RETENTION_DAYS * DAY_MS).toISOString(),
      extracted.extraction,
      organizationId,
    )
    .run();
  const object = JSON.stringify({ method, url: body.postingUrl ?? null, fetched_at: fetchedAt, raw: raw.slice(0, MAX_RAW_CHARS), notes });
  const put = (async () => bucket.put(r2Key, object))();
  const [inserted, stored] = await Promise.allSettled([insert, put]);

  if (inserted.status === "rejected") {
    if (stored.status === "fulfilled") await bucket.delete(r2Key).catch(() => undefined);
    const winner = served?.board !== undefined && served.externalId !== undefined ? await existingId(db, served.board, served.externalId) : null;
    if (winner && reusable(winner, organizationId) && errorMessage(inserted.reason).includes("UNIQUE")) return { ok: true, id: winner.id, reused: true, notes: [] };
    throw inserted.reason;
  }
  if (stored.status === "rejected") {
    await db.prepare("UPDATE positions SET r2_key = NULL WHERE id = ?").bind(id).run();
    notes.push(`raw posting not stored (${errorMessage(stored.reason)})`);
  }
  return { ok: true, id, reused: false, notes };
}
