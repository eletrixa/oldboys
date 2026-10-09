/**
 * Tests for the treg.to adapter: url building, headers, POST body, cost header, error snippet, empty body.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/__tests__/treg.test.ts
 * Deps:    vitest (fake global fetch)
 * Tested:  itself
 *
 * Key responsibilities:
 * - GET query and POST JSON body, X-Treg-* headers, real cost from X-Treg-Cost-Micro, 402 throws, empty body is null
 *
 * Design constraints:
 * - No network
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTregCall, tregUrl } from "@/adapters/treg";

function stub(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}
const headersOf = (fn: ReturnType<typeof stub>, i = 0) => new Headers(fn.mock.calls[i]?.[1]?.headers);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("makeTregCall", () => {
  it("GETs the endpoint with params as query and the treg headers", async () => {
    const fn = stub(Response.json({ ok: 1 }, { headers: { "x-treg-cost-micro": "1500" } }));
    const out = await makeTregCall("tok")({ endpoint: "tikhub.instagram.user.profile", method: "GET", params: { username: "x y", n: 2, flag: true, ids: ["a", "b"] }, maxCostUsd: 0.005 });
    expect(fn.mock.calls[0]?.[0]).toBe("https://treg.to/call/tikhub.instagram.user.profile?username=x+y&n=2&flag=true&ids=a%2Cb");
    expect(fn.mock.calls[0]?.[1]?.method).toBe("GET");
    expect(fn.mock.calls[0]?.[1]?.body).toBeUndefined();
    const h = headersOf(fn);
    expect(h.get("x-treg-token")).toBe("tok");
    expect(h.get("x-treg-route-max-cost")).toBe("0.005");
    expect(h.get("accept")).toBe("application/json");
    expect(h.get("user-agent")).toContain("oldboys");
    expect(out).toEqual({ payload: { ok: 1 }, cost_usd: 0.0015 });
  });

  it("POSTs params as a JSON body to the bare endpoint url", async () => {
    const fn = stub(Response.json({ ok: 1 }));
    await makeTregCall("tok")({ endpoint: "anyapi.x.user.profile", method: "POST", params: { handle: "jack" }, maxCostUsd: 0.01 });
    expect(fn.mock.calls[0]?.[0]).toBe("https://treg.to/call/anyapi.x.user.profile");
    expect(fn.mock.calls[0]?.[1]?.body).toBe('{"handle":"jack"}');
    expect(headersOf(fn).get("content-type")).toBe("application/json");
    expect(headersOf(fn).get("x-treg-route-max-cost")).toBe("0.01");
  });

  it("reports cost 0 when the cost header is missing or not a number", async () => {
    stub(Response.json({}), Response.json({}, { headers: { "x-treg-cost-micro": "abc" } }));
    const call = makeTregCall("tok");
    const req = { endpoint: "e", method: "GET", params: {}, maxCostUsd: 0.001 } as const;
    expect((await call(req)).cost_usd).toBe(0);
    expect((await call(req)).cost_usd).toBe(0);
  });

  it("throws with status and a body snippet on 402", async () => {
    stub(new Response('{"detail":{"error":"insufficient_balance",\n "x":"y"}}', { status: 402 }));
    await expect(makeTregCall("tok")({ endpoint: "e", method: "GET", params: {}, maxCostUsd: 0.001 })).rejects.toThrow(
      'treg e: HTTP 402 {"detail":{"error":"insufficient_balance", "x":"y"}}',
    );
  });

  it("returns a null payload for an empty 2xx body", async () => {
    stub(new Response(null, { status: 200 }));
    await expect(makeTregCall("tok")({ endpoint: "e", method: "GET", params: {}, maxCostUsd: 0.001 })).resolves.toEqual({ payload: null, cost_usd: 0 });
  });
});

describe("tregUrl", () => {
  it("has no query string for empty params", () => {
    expect(tregUrl("e", {}, "GET")).toBe("https://treg.to/call/e");
  });
});
