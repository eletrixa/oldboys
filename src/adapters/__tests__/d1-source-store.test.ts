/**
 * makeSourceStore: the same-page guard and how an enriching collector's second read gets past it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/__tests__/d1-source-store.test.ts
 * Deps:    vitest, src/adapters/d1
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Default: a url another step of the run already stored (under another id) is not inserted again
 * - enriches: the guard also requires the same actor, so a second read of the page by another provider is a second row
 * - R2 gets `<run>/<source>.json`; the returned Source carries that key
 *
 * Design constraints:
 * - Fake D1 and R2 only capture the SQL text and binds; no bindings runtime
 */
import { describe, expect, it } from "vitest";
import { makeSourceStore } from "@/adapters/d1";

function fakes() {
  const calls: { sql: string; binds: unknown[] }[] = [];
  const puts: string[] = [];
  const db = {
    prepare: (sql: string) => ({ bind: (...binds: unknown[]) => ({ run: () => { calls.push({ sql, binds }); return Promise.resolve({ meta: { changes: 1 } }); } }) }),
  } as unknown as D1Database;
  const bucket = { put: (key: string) => { puts.push(key); return Promise.resolve(null); } } as unknown as R2Bucket;
  return { calls, puts, store: makeSourceStore(db, bucket) };
}
const source = {
  id: "s-2", run_id: "run-1", url: "https://www.linkedin.com/in/jana", actor: "treg/social-verify", fetched_at: "2026-10-09T00:00:00.000Z",
  excerpt: "x", expires_at: "2026-10-16T00:00:00.000Z", identity: "merged" as const,
};

describe("makeSourceStore", () => {
  it("skips a url another step already stored, whatever the actor", async () => {
    const { calls, puts, store } = fakes();
    const full = await store(source, { a: 1 });
    expect(full.r2_key).toBe("run-1/s-2.json");
    expect(puts).toEqual(["run-1/s-2.json"]);
    const [c] = calls;
    expect(c?.sql).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM sources WHERE run_id = \? AND url = \? AND id <> \?\)/);
    expect(c?.binds.slice(-3)).toEqual(["run-1", "https://www.linkedin.com/in/jana", "s-2"]);
  });

  it("enriches: only the same actor's earlier row blocks the insert, so a second read of the page by another provider is stored", async () => {
    const { calls, store } = fakes();
    await store(source, {}, { enriches: true });
    const [c] = calls;
    expect(c?.sql).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM sources WHERE run_id = \? AND url = \? AND id <> \? AND actor = \?\)/);
    expect(c?.binds.slice(-4)).toEqual(["run-1", "https://www.linkedin.com/in/jana", "s-2", "treg/social-verify"]);
  });
});
