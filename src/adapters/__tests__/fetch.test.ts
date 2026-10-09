/**
 * Tests for the JSON fetch adapter: per-host credentials, error body snippet, single retry.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/__tests__/fetch.test.ts
 * Deps:    vitest (fake global fetch)
 * Tested:  itself
 *
 * Key responsibilities:
 * - Token only for api.github.com, snippet in error, one retry on 429 and 202
 *
 * Design constraints:
 * - No network; retry delay set to 0
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFetchJson } from "@/adapters/fetch";

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

describe("makeFetchJson", () => {
  it("adds the GitHub bearer token only for api.github.com", async () => {
    const fn = stub(Response.json({}), Response.json({}));
    const f = makeFetchJson({ githubToken: "tok", retryDelayMs: 0 });
    await f("https://api.github.com/users/x");
    await f("https://api.openalex.org/authors");
    expect(headersOf(fn, 0).get("authorization")).toBe("Bearer tok");
    expect(headersOf(fn, 1).get("authorization")).toBeNull();
  });

  it("returns the body as text when the request accepts text/html or XML", async () => {
    stub(new Response("<html>ok</html>", { headers: { "content-type": "text/html" } }), new Response("<xml/>"));
    const f = makeFetchJson();
    await expect(f("https://isir.justice.cz/x", { headers: { accept: "text/html" } })).resolves.toBe("<html>ok</html>");
    await expect(f("https://isir.justice.cz/y", { headers: { accept: "text/xml" } })).resolves.toBe("<xml/>");
  });

  it("adds no authorization header without a token", async () => {
    const fn = stub(Response.json({}));
    await makeFetchJson()("https://api.github.com/users/x");
    expect(headersOf(fn).get("authorization")).toBeNull();
  });

  it("appends the Stack Exchange key only for api.stackexchange.com", async () => {
    const fn = stub(Response.json({}), Response.json({}));
    const f = makeFetchJson({ stackExchangeKey: "k" });
    await f("https://api.stackexchange.com/2.3/users?site=stackoverflow");
    await f("https://api.github.com/users/x");
    expect((fn.mock.calls[0]?.[0] as string)).toContain("key=k");
    expect((fn.mock.calls[1]?.[0] as string)).not.toContain("key=");
  });

  it("appends the OpenAlex api_key only for api.openalex.org", async () => {
    const fn = stub(Response.json({}), Response.json({}));
    const f = makeFetchJson({ openAlexKey: "oak" });
    await f("https://api.openalex.org/authors?search=x");
    await f("https://api.github.com/users/x");
    expect(fn.mock.calls[0]?.[0] as string).toContain("api_key=oak");
    expect(fn.mock.calls[1]?.[0] as string).not.toContain("api_key=");
  });

  it("does not append api_key when the OpenAlex key is unset", async () => {
    const fn = stub(Response.json({}));
    await makeFetchJson()("https://api.openalex.org/authors");
    expect(fn.mock.calls[0]?.[0] as string).not.toContain("api_key");
  });

  it("never leaks the OpenAlex key in the error message", async () => {
    stub(new Response("nope", { status: 400 }));
    const err = (await makeFetchJson({ openAlexKey: "secret-oak" })("https://api.openalex.org/authors").catch((e: unknown) => e)) as Error;
    expect(err.message).toContain("api.openalex.org/authors: HTTP 400");
    expect(err.message).not.toContain("secret-oak");
  });

  it("puts a bounded body snippet in the error", async () => {
    stub(new Response("x".repeat(500), { status: 400 }));
    const err = (await makeFetchJson()("https://api.stackexchange.com/2.3/users").catch((e: unknown) => e)) as Error;
    expect(err.message).toMatch(/^https:\/\/api\.stackexchange\.com\/2\.3\/users: HTTP 400 x{160}$/);
  });

  it("retries once on 429 and returns the second response", async () => {
    const fn = stub(new Response("slow down", { status: 429 }), Response.json({ ok: 1 }));
    await expect(makeFetchJson({ retryDelayMs: 0 })("https://api.openalex.org/authors")).resolves.toEqual({ ok: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries once on 202 and returns the second body", async () => {
    const fn = stub(new Response("", { status: 202 }), Response.json([{ total: 3 }]));
    await expect(makeFetchJson({ retryDelayMs: 0 })("https://api.github.com/repos/o/r/stats/contributors")).resolves.toEqual([{ total: 3 }]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns null for an empty 202 body after the retry", async () => {
    const fn = stub(new Response("", { status: 202 }), new Response("", { status: 202 }));
    await expect(makeFetchJson({ retryDelayMs: 0 })("https://api.github.com/repos/o/r/stats/contributors")).resolves.toBeNull();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not re-send a POST on 202", async () => {
    const fn = stub(Response.json({ accepted: true }, { status: 202 }), Response.json({ nope: 1 }));
    await expect(makeFetchJson({ retryDelayMs: 0 })("https://ares.gov.cz/x", { method: "POST", body: "{}" })).resolves.toEqual({ accepted: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry twice", async () => {
    const fn = stub(new Response("a", { status: 429 }), new Response("b", { status: 429 }));
    await expect(makeFetchJson({ retryDelayMs: 0 })("https://api.openalex.org/authors")).rejects.toThrow("HTTP 429 b");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
