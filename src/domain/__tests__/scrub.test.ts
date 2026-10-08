/**
 * Tests for the reason scrub: URLs, e-mails, phone numbers, whitespace, length cap and unchanged recipe reasons.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/scrub.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Each rule on its own, the real OpenAlex 429 failure text, and plain reasons that must pass unchanged
 *
 * Design constraints:
 * - Fixtures stay inline; no real people
 */
import { describe, expect, it } from "vitest";
import { scrubReason } from "@/domain/scrub";

describe("scrubReason", () => {
  it("keeps plain recipe reasons unchanged", () => {
    for (const reason of [
      "no public GitHub profile found",
      "run budget reached",
      "hits found, none confirmed (same name, identity not verified)",
      "no confirmed handle or id to look up",
      "not collected: public Facebook pages need a login",
    ]) {
      expect(scrubReason(reason)).toBe(reason);
    }
  });

  it("reduces a URL to its hostname and keeps trailing punctuation", () => {
    expect(scrubReason("see https://example.org/people/jan?q=1#top.")).toBe("see example.org.");
    expect(scrubReason("(http://sub.example.com/a), then")).toBe("(sub.example.com), then");
    expect(scrubReason("fetch https://api.example.com/x?name=a: timeout")).toBe("fetch api.example.com: timeout");
  });

  it("replaces a URL that does not parse with (link)", () => {
    expect(scrubReason("bad https://[nope/x here")).toBe("bad (link) here");
  });

  it("replaces e-mail addresses, with or without mailto:", () => {
    expect(scrubReason("contact jana.d+cv@example.cz or mailto:hr@example.com")).toBe("contact (email) or (email)");
  });

  it("replaces phone-like numbers and keeps dates, status codes and small counts", () => {
    expect(scrubReason("call to +420 777 123 456 failed")).toBe("call to (number) failed");
    expect(scrubReason("call to (+420) 777-123-456 failed")).toBe("call to (number) failed");
    expect(scrubReason("number 777.123.456 busy")).toBe("number (number) busy");
    expect(scrubReason("HTTP 429 on 2026-10-08, 3 retries, 12 items")).toBe("HTTP 429 on 2026-10-08, 3 retries, 12 items");
    expect(scrubReason("HTTP 503 2026-10-08 20:00")).toBe("HTTP 503 2026-10-08 20:00");
  });

  it("collapses whitespace, trims and caps at 160 characters with an ellipsis", () => {
    expect(scrubReason("  timed\n out \t after   30 s ")).toBe("timed out after 30 s");
    const long = scrubReason(`${"word ".repeat(60)}end`);
    expect(long).toHaveLength(160);
    expect(long.endsWith("…")).toBe(true);
  });

  it("scrubs the real OpenAlex 429 failure text", () => {
    const out = scrubReason(
      'request failed: https://api.openalex.org/authors?search=Jan%20Novak&per-page=5&mailto=robert@soulfire.cz: HTTP 429 {"error":"Too Many Requests"}',
    );
    expect(out).toContain("request failed");
    expect(out).toContain("api.openalex.org");
    expect(out).toContain("HTTP 429");
    for (const leak of ["robert@soulfire.cz", "mailto", "search=", "Jan%20Novak"]) expect(out).not.toContain(leak);
  });
});
