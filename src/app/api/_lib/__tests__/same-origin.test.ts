/**
 * Tests for the same-origin browser check.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/same-origin.test.ts
 * Deps:    vitest, ../same-origin
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - GET passes on Sec-Fetch-Site alone (browsers send no Origin on same-origin GETs)
 * - POST needs Sec-Fetch-Site and a matching Origin/Host pair
 *
 * Design constraints:
 * - Pure Request objects, no bindings
 */
import { describe, expect, it } from "vitest";
import { isSameOriginBrowserRequest } from "../same-origin";

function req(method: string, headers: Record<string, string>): Request {
  return new Request("https://x.test/api/ares/27074358", { method, headers });
}

describe("isSameOriginBrowserRequest", () => {
  it("accepts a same-origin GET without an Origin header", () => {
    expect(isSameOriginBrowserRequest(req("GET", { "Sec-Fetch-Site": "same-origin", Host: "x.test" }))).toBe(true);
  });

  it("rejects a GET without Sec-Fetch-Site", () => {
    expect(isSameOriginBrowserRequest(req("GET", { Host: "x.test" }))).toBe(false);
  });

  it("accepts a POST with matching Origin and Host", () => {
    expect(
      isSameOriginBrowserRequest(req("POST", { "Sec-Fetch-Site": "same-origin", Origin: "https://x.test", Host: "x.test" })),
    ).toBe(true);
  });

  it("rejects a POST without Origin or with a foreign Origin", () => {
    expect(isSameOriginBrowserRequest(req("POST", { "Sec-Fetch-Site": "same-origin", Host: "x.test" }))).toBe(false);
    expect(
      isSameOriginBrowserRequest(req("POST", { "Sec-Fetch-Site": "same-origin", Origin: "https://evil.test", Host: "x.test" })),
    ).toBe(false);
  });
});
