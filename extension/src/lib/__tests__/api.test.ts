/**
 * Tests for the API client with an injected fetch.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/lib/__tests__/api.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - startRun sends the bearer token and the mark; 200 means reused, 201 means new
 * - 401, 429, 404 and malformed bodies become typed ApiErrors
 * - getStatus validates against the shared RunStatus schema
 *
 * Design constraints:
 * - No network: fetch is a stub returning Response objects
 */
import { describe, expect, it } from "vitest";
import { ApiError, getStatus, runUrl, Settings, startRun, type Fetch } from "../api";

const settings = Settings.parse({ token: "t0k", apiBase: "https://oldboys.test" });
const mark = { subject: "Jan", anchor: "Prague", goal: "hiring" as const, sourceUrl: "https://www.linkedin.com/in/jan" };

const respond = (status: number, body: unknown): Fetch => () =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("startRun", () => {
  it("posts the mark with the bearer token and reports reuse", async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: Fetch = (url, init) => {
      seen.push({ url, init });
      return respond(200, { id: "r1", reused: true })(url, init);
    };
    await expect(startRun(settings, mark, fetchImpl)).resolves.toEqual({ id: "r1", reused: true });
    const call = seen[0];
    expect(call).toMatchObject({ url: "https://oldboys.test/api/runs", init: { method: "POST" } });
    expect(new Headers(call?.init?.headers).get("Authorization")).toBe("Bearer t0k");
    const body = call?.init?.body;
    expect(JSON.parse(typeof body === "string" ? body : "null")).toEqual(mark);
  });

  it("refuses without a token and maps 401 / 429 / junk", async () => {
    await expect(startRun(Settings.parse({}), mark, respond(201, { id: "x" }))).rejects.toMatchObject({ code: "no-token" });
    await expect(startRun(settings, mark, respond(401, {}))).rejects.toMatchObject({ code: "unauthorized" });
    await expect(startRun(settings, mark, respond(429, {}))).rejects.toMatchObject({ code: "rate-limited" });
    await expect(startRun(settings, mark, respond(201, { nope: 1 }))).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getStatus", () => {
  it("validates the projection and maps 404", async () => {
    const body = { id: "r1", subject: "Jan", goal: "hiring", status: "done", facts: 1, inferences: 0, statements: 0, gaps: 0, needsAnswer: null, createdAt: "2026-10-08T20:00:00.000Z" };
    await expect(getStatus(settings, "r1", respond(200, body))).resolves.toEqual(body);
    await expect(getStatus(settings, "r1", respond(404, {}))).rejects.toMatchObject({ code: "not-found" });
    await expect(getStatus(settings, "r1", respond(200, { id: "r1" }))).rejects.toMatchObject({ code: "bad-response" });
  });
});

it("runUrl points at the app's report page", () => {
  expect(runUrl(settings, "a b")).toBe("https://oldboys.test/runs/a%20b");
});
