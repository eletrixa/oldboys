/**
 * Tests for the same-origin browser check used by the public form endpoints.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/__tests__/origin.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover the accept path and each missing or mismatching header
 *
 * Design constraints:
 * - Plain Request objects; no module mocks
 */
import { describe, expect, it } from "vitest";
import { fromOurPage } from "../origin";

const req = (headers: Record<string, string>): Request => new Request("https://oldboys.test/api/apply", { method: "POST", headers });
const good = { Origin: "https://oldboys.test", Host: "oldboys.test", "Sec-Fetch-Site": "same-origin" };

describe("fromOurPage", () => {
  it("accepts a same-origin browser request", () => {
    expect(fromOurPage(req(good))).toBe(true);
  });

  it("rejects cross-site, missing or foreign origin headers", () => {
    expect(fromOurPage(req({ ...good, "Sec-Fetch-Site": "cross-site" }))).toBe(false);
    expect(fromOurPage(req({ Host: good.Host, "Sec-Fetch-Site": good["Sec-Fetch-Site"] }))).toBe(false);
    expect(fromOurPage(req({ ...good, Origin: "https://evil.test" }))).toBe(false);
    expect(fromOurPage(req({ ...good, Origin: "https://evil.oldboys.test.evil.test" }))).toBe(false);
    expect(fromOurPage(req({ Origin: good.Origin, "Sec-Fetch-Site": good["Sec-Fetch-Site"] }))).toBe(false);
  });
});
