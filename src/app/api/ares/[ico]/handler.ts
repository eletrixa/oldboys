/**
 * lookupCompany: ARES company lookup by IČO with a 24 h D1 cache.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/ares/[ico]/handler.ts
 * Deps:    src/domain/{ico,organization,ports}, D1 table ares_cache
 * Tested:  src/app/api/ares/__tests__/lookup.test.ts
 *
 * Key responsibilities:
 * - Normalize the IČO (400 on bad checksum), replay a fresh cache row, else fetch ARES and cache the result
 * - 200 {company}, 404 {error} for an unknown IČO (cached too), 502 {error} when ARES fails (never cached)
 *
 * Design constraints:
 * - ARES terms forbid repeating identical queries, hence the cache; failures other than 404 are not cached
 * - No Next.js imports; fetch and clock are parameters
 */
import { normalizeIco } from "@/domain/ico";
import { ARES_BASE, AresSubjekt, organizationFromAres } from "@/domain/organization";
import type { JsonFetch } from "@/domain/ports";

export type AresDeps = { db: D1Database; fetchJson: JsonFetch; now: () => Date };

export const ARES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheRow = { status: "found" | "not_found"; payload_json: string | null; fetched_at: string };

const notFound = (): Response => Response.json({ error: "company not found" }, { status: 404 });
const unavailable = (): Response => Response.json({ error: "ares unavailable" }, { status: 502 });

function replay(row: CacheRow): Response | null {
  if (row.status === "not_found") return notFound();
  if (row.payload_json === null) return null;
  const parsed = AresSubjekt.safeParse(JSON.parse(row.payload_json));
  return parsed.success ? Response.json({ company: organizationFromAres(parsed.data) }) : null;
}

function cache(deps: AresDeps, ico: string, status: CacheRow["status"], payload: unknown): Promise<unknown> {
  return deps.db
    .prepare("INSERT OR REPLACE INTO ares_cache (ico, status, payload_json, fetched_at) VALUES (?, ?, ?, ?)")
    .bind(ico, status, payload === null ? null : JSON.stringify(payload), deps.now().toISOString())
    .run();
}

export async function lookupCompany(rawIco: string, deps: AresDeps): Promise<Response> {
  const ico = normalizeIco(rawIco);
  if (ico === null) return Response.json({ error: "invalid ico" }, { status: 400 });

  const row = await deps.db
    .prepare("SELECT status, payload_json, fetched_at FROM ares_cache WHERE ico = ?")
    .bind(ico)
    .first<CacheRow>();
  if (row !== null && deps.now().getTime() - new Date(row.fetched_at).getTime() < ARES_CACHE_TTL_MS) {
    const cached = replay(row);
    if (cached !== null) return cached;
  }

  let raw: unknown;
  try {
    raw = await deps.fetchJson(`${ARES_BASE}/ekonomicke-subjekty/${ico}`);
  } catch (e) {
    if (e instanceof Error && /HTTP 404\b/.test(e.message)) {
      await cache(deps, ico, "not_found", null);
      return notFound();
    }
    console.warn("ares lookup failed", e instanceof Error ? e.message : String(e));
    return unavailable();
  }
  const subject = AresSubjekt.safeParse(raw);
  if (!subject.success) return unavailable();
  await cache(deps, ico, "found", subject.data);
  return Response.json({ company: organizationFromAres(subject.data) });
}
