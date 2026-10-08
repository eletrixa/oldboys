/**
 * Tests for lookupCompany with a fake fetchJson and a hand-written D1 cache.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/ares/__tests__/lookup.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover found, cached replay, IČO padding, 404 cached, 503 not cached, invalid IČO, stale cache
 *
 * Design constraints:
 * - No module mocks; the fake D1 dispatches on the two ares_cache SQL prefixes
 */
import { describe, expect, it, vi } from "vitest";
import { lookupCompany } from "../[ico]/handler";

const NOW = new Date("2026-10-08T12:00:00Z");

type Row = { status: string; payload_json: string | null; fetched_at: string };

function setup(fetchImpl: (url: string) => Promise<unknown>) {
  const cache = new Map<string, Row>();
  const urls: string[] = [];
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    first: () => {
      if (!sql.startsWith("SELECT status, payload_json, fetched_at FROM ares_cache")) throw new Error(sql);
      return Promise.resolve(cache.get(args[0] as string) ?? null);
    },
    run: () => {
      if (!sql.startsWith("INSERT OR REPLACE INTO ares_cache")) throw new Error(sql);
      cache.set(args[0] as string, {
        status: args[1] as string,
        payload_json: args[2] as string | null,
        fetched_at: args[3] as string,
      });
      return Promise.resolve({ meta: { changes: 1 } });
    },
  });
  const deps = {
    db: { prepare: (sql: string) => stmt(sql) } as unknown as D1Database,
    fetchJson: (url: string) => {
      urls.push(url);
      return fetchImpl(url);
    },
    now: () => NOW,
  };
  return { deps, cache, urls };
}

const subject = {
  ico: "27074358",
  obchodniJmeno: "Asseco Central Europe, a.s.",
  pravniForma: "121",
  sidlo: { textovaAdresa: "Budějovická 778/3a, Michle, 140 00 Praha 4" },
};

describe("lookupCompany", () => {
  it("returns the company and caches it, second call skips ARES", async () => {
    const { deps, cache, urls } = setup(() => Promise.resolve(subject));
    const res = await lookupCompany("27074358", deps);
    expect(res.status).toBe(200);
    const body = await res.json<{ company: { name: string; legal_form: string; address: string } }>();
    expect(body.company).toMatchObject({
      name: "Asseco Central Europe, a.s.",
      legal_form: "121",
      address: "Budějovická 778/3a, Michle, 140 00 Praha 4",
    });
    expect(cache.get("27074358")?.status).toBe("found");
    const again = await lookupCompany("27074358", deps);
    expect(again.status).toBe(200);
    expect(urls).toHaveLength(1);
  });

  it("pads a short IČO to 8 digits in the URL", async () => {
    const { deps, urls } = setup(() => Promise.resolve({ ico: "00006947", obchodniJmeno: "Ministerstvo financí" }));
    const res = await lookupCompany("6947", deps);
    expect(res.status).toBe(200);
    expect(urls[0]).toMatch(/\/ekonomicke-subjekty\/00006947$/);
  });

  it("404 on an unknown IČO and caches the miss", async () => {
    const { deps, cache, urls } = setup(() =>
      Promise.reject(new Error('GET x: HTTP 404 {"kod":"NENALEZENO"}')),
    );
    expect((await lookupCompany("27074358", deps)).status).toBe(404);
    expect(cache.get("27074358")?.status).toBe("not_found");
    expect((await lookupCompany("27074358", deps)).status).toBe(404);
    expect(urls).toHaveLength(1);
  });

  it("502 on an ARES outage and caches nothing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { deps, cache } = setup(() => Promise.reject(new Error("GET x: HTTP 503 down")));
    const res = await lookupCompany("27074358", deps);
    warn.mockRestore();
    expect(res.status).toBe(502);
    expect(cache.size).toBe(0);
  });

  it("400 on a bad checksum without fetching", async () => {
    const { deps, urls } = setup(() => Promise.resolve(subject));
    const res = await lookupCompany("12345678", deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid ico" });
    expect(urls).toHaveLength(0);
  });

  it("refetches when the cache row is older than 24 h", async () => {
    const { deps, cache, urls } = setup(() => Promise.resolve(subject));
    cache.set("27074358", {
      status: "found",
      payload_json: JSON.stringify({ ico: "27074358", obchodniJmeno: "Old name" }),
      fetched_at: new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString(),
    });
    const res = await lookupCompany("27074358", deps);
    expect((await res.json<{ company: { name: string } }>()).company.name).toBe("Asseco Central Europe, a.s.");
    expect(urls).toHaveLength(1);
  });
});
