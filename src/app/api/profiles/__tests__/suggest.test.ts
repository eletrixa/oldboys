/**
 * Tests for suggestProfiles with a fake fetchJson standing in for Brave Web Search.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/profiles/__tests__/suggest.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - 200 with parsed suggestions and the query/headers sent; empty web block; 400 short query; 503 no key; 502 on throw or bad shape
 *
 * Design constraints:
 * - No module mocks; the fake records the URL and headers it was called with
 */
import { describe, expect, it, vi } from "vitest";
import { BRAVE_SEARCH_URL, suggestProfiles } from "../suggest/handler";

function fake(result: unknown) {
  const calls: { url: string; headers: Record<string, string> | undefined }[] = [];
  const fetchJson = vi.fn((url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers });
    return typeof result === "function" ? (result as () => Promise<unknown>)() : Promise.resolve(result);
  });
  return { fetchJson, calls };
}

const payload = {
  web: {
    results: [
      { title: "Jan Novák - Data Engineer - Seznam | LinkedIn", url: "https://cz.linkedin.com/in/jan-novak", description: "Praha" },
      { title: "Seznam", url: "https://www.linkedin.com/company/seznam-cz" },
    ],
  },
};

describe("suggestProfiles", () => {
  it("queries Brave with the site filter and the key, returns parsed suggestions", async () => {
    const { fetchJson, calls } = fake(payload);
    const res = await suggestProfiles(" Jan  Novák ", "Seznam", { fetchJson, key: "k1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      suggestions: [{ url: "https://www.linkedin.com/in/jan-novak", name: "Jan Novák", headline: "Data Engineer · Seznam", snippet: "Praha" }],
      source: "web-search",
    });
    const u = new URL(calls[0]?.url ?? "");
    expect(`${u.origin}${u.pathname}`).toBe(BRAVE_SEARCH_URL);
    expect(u.searchParams.get("q")).toBe('site:linkedin.com/in "Jan Novák" Seznam');
    expect(u.searchParams.get("country")).toBe("cz");
    expect(calls[0]?.headers).toEqual({ "X-Subscription-Token": "k1" });
  });

  it("returns an empty list when the provider has no web block", async () => {
    const res = await suggestProfiles("Jan Novák", "", { fetchJson: fake({ query: {} }).fetchJson, key: "k" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: [], source: "web-search" });
  });

  it("rejects a short query without calling the provider", async () => {
    const { fetchJson } = fake(payload);
    const res = await suggestProfiles("Ja", "", { fetchJson, key: "k" });
    expect(res.status).toBe(400);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("answers 503 without a key and never calls the provider", async () => {
    const { fetchJson } = fake(payload);
    const res = await suggestProfiles("Jan Novák", "", { fetchJson, key: "" });
    expect(res.status).toBe(503);
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("answers 502 when the provider throws or answers nonsense", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const down = fake(() => Promise.reject(new Error("HTTP 429 rate limited")));
    expect((await suggestProfiles("Jan Novák", "", { fetchJson: down.fetchJson, key: "k" })).status).toBe(502);
    const odd = fake({ web: { results: "no" } });
    expect((await suggestProfiles("Jan Novák", "", { fetchJson: odd.fetchJson, key: "k" })).status).toBe(502);
  });
});
