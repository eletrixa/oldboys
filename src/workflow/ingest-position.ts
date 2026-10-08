/**
 * Position ingest: a pasted posting or a posting URL becomes one stored `positions` row with at most 5 editable must-haves.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/ingest-position.ts
 * Deps:    D1Database, R2Bucket (passed in), src/recipe/seams/{posting-plan,posting-parse,posting-strip,position-extract}, src/domain/audit (RETENTION_DAYS)
 * Tested:  src/workflow/__tests__/ingest-position.test.ts
 *
 * Key responsibilities:
 * - Order: fetch plan, dedupe on (board, external_id), fetch with a 20 s abort, parse, strip boilerplate, one capped LLM extract, insert, R2 put
 * - Paste always works: a failed fetch falls back to the pasted text with a note, a failed LLM or R2 put never fails the ingest
 * - Records the single LLM call's cost in `ingest_cost_usd`; the raw payload goes to R2 `positions/<id>.json` and is purged with the row
 *
 * Design constraints:
 * - No paid actor call, no Next.js import; fetch, clock, ids and the cost estimate are injected
 * - `board` and `external_id` are stored only when the fetch path actually served the text, so a failed fetch never pins a degraded row as the dedupe hit
 */
import { RETENTION_DAYS } from "@/domain/audit";
import type { Ports } from "@/domain/ports";
import { extractPosition } from "@/recipe/seams/position-extract";
import { parsePosting, type ParsedPosting } from "@/recipe/seams/posting-parse";
import { type PostingMethod, postingFetchPlan } from "@/recipe/seams/posting-plan";
import { stripBoilerplate } from "@/recipe/seams/posting-strip";

const FETCH_TIMEOUT_MS = 20_000;
const MIN_FETCHED_CHARS = 200;
const MAX_TEXT_CHARS = 20_000;
const MAX_RAW_CHARS = 500_000;
const EXCERPT_CHARS = 1000;
const DEFAULT_CAP_USD = 0.05;
const DAY_MS = 24 * 60 * 60 * 1000;
const UA = "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)";

export type IngestDeps = {
  db: D1Database;
  bucket: R2Bucket;
  ports: Pick<Ports, "llm">;
  fetchFn: typeof fetch;
  now: Date;
  newId: () => string;
  capUsd: number;
  estimateUsd: (text: string) => number;
};
export type IngestBody = { postingText?: string; postingUrl?: string; title?: string };
export type IngestResult = { ok: true; id: string; reused: boolean; notes: string[] } | { ok: false; status: 422; error: string };

/** Chars / 4 tokens at a conservative $5 per million input tokens, plus 800 output tokens at $20 per million. */
export const estimatePositionUsd = (text: string): number => (text.length / 4) * (5 / 1_000_000) + 800 * (20 / 1_000_000);

/** `POSITION_INGEST_USD` var to a USD cap; unset or not a positive number gives the default. */
export function ingestCapUsd(raw: string | undefined): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP_USD;
}

const whyOf = (e: unknown): string => (e instanceof Error ? e.message : "unknown error");
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

async function fetchText(fetchFn: typeof fetch, url: string): Promise<string> {
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctl.abort();
      reject(new Error("timed out after 20 s"));
    }, FETCH_TIMEOUT_MS);
  });
  try {
    const read = fetchFn(url, { signal: ctl.signal, headers: { "user-agent": UA, accept: "application/json, text/html;q=0.9" } }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return res.text();
    });
    return await Promise.race([read, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const existingId = (db: D1Database, board: string, externalId: string) =>
  db.prepare("SELECT id FROM positions WHERE board = ? AND external_id = ?").bind(board, externalId).first<{ id: string }>();

export async function ingestPosition(deps: IngestDeps, body: IngestBody): Promise<IngestResult> {
  const { db, bucket, now } = deps;
  const plan = postingFetchPlan(body.postingUrl ?? null);
  const pasted = body.postingText?.trim() ?? "";

  if (plan.board !== undefined && plan.externalId !== undefined) {
    const hit = await existingId(db, plan.board, plan.externalId);
    if (hit) return { ok: true, id: hit.id, reused: true, notes: [] };
  }

  const notes: string[] = [];
  let method: PostingMethod = "pasted";
  let parsed: ParsedPosting = { text: pasted };
  let raw = pasted;
  const fetchedAt = now.toISOString();
  if (plan.request) {
    try {
      const payload = await fetchText(deps.fetchFn, plan.request.url);
      const candidate = parsePosting(plan.method, payload, plan.externalId);
      if (candidate.text.length < MIN_FETCHED_CHARS) throw new Error("posting text not found in the response");
      method = plan.method;
      parsed = candidate;
      raw = payload;
    } catch (e) {
      if (pasted === "") {
        const error = `could not read the posting at ${hostOf(plan.request.url)}: ${whyOf(e)}; paste the posting text instead`;
        return { ok: false, status: 422, error };
      }
      notes.push(`fetch via ${plan.method} failed (${whyOf(e)}), used the pasted text`);
    }
  } else if (pasted === "") {
    return { ok: false, status: 422, error: "no posting text and the URL cannot be fetched; paste the posting text instead" };
  }

  const stripped = stripBoilerplate(parsed.text).trim();
  const text = (stripped === "" ? parsed.text : stripped).slice(0, MAX_TEXT_CHARS);
  const hint = { title: body.title ?? parsed.title, company: parsed.company, location: parsed.location };
  const overCap = deps.estimateUsd(text) > deps.capUsd;
  const ports = overCap ? { llm: () => Promise.reject(new Error("over cap")) } : deps.ports;
  const extracted = await extractPosition(text, ports, hint);
  notes.push(...(overCap ? ["position extract: estimated cost over POSITION_INGEST_USD, used generic fallback"] : extracted.notes));

  const id = deps.newId();
  const r2Key = `positions/${id}.json`;
  const served = method === "pasted" ? undefined : plan;
  try {
    await db
      .prepare(
        `INSERT INTO positions (id, title, family, company, location, board, posting_url, external_id, must_haves_json, excerpt, r2_key, ingest_method, ingest_cost_usd, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        extracted.title,
        extracted.family,
        extracted.company ?? null,
        extracted.location ?? null,
        served?.board ?? null,
        plan.request ? (body.postingUrl ?? null) : null,
        served?.externalId ?? null,
        JSON.stringify(extracted.must_haves),
        text.slice(0, EXCERPT_CHARS),
        r2Key,
        method,
        extracted.cost_usd,
        fetchedAt,
        new Date(now.getTime() + RETENTION_DAYS * DAY_MS).toISOString(),
      )
      .run();
  } catch (e) {
    const winner = served?.board !== undefined && served.externalId !== undefined ? await existingId(db, served.board, served.externalId) : null;
    if (winner && whyOf(e).includes("UNIQUE")) return { ok: true, id: winner.id, reused: true, notes: [] };
    throw e;
  }

  try {
    const object = { method, url: body.postingUrl ?? null, fetched_at: fetchedAt, raw: raw.slice(0, MAX_RAW_CHARS), notes };
    await bucket.put(r2Key, JSON.stringify(object));
  } catch (e) {
    await db.prepare("UPDATE positions SET r2_key = NULL WHERE id = ?").bind(id).run();
    notes.push(`raw posting not stored (${whyOf(e)})`);
  }
  return { ok: true, id, reused: false, notes };
}
