/**
 * Tests for the intake pure helpers: status and source labels, dates, the run-page line.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/intake/__tests__/intake-rows.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - STATUS_LABEL / STATUS_TONE cover every ApplicationStatus; SOURCE_LABEL every ApplicationSource
 * - formatReceived: UTC "YYYY-MM-DD HH:MM", the raw string when unparseable
 * - intakeLine: "From <source> · <tag> · <date>", tag omitted when absent; a manual add reads "Added by hand · <date>"
 *
 * Design constraints:
 * - Pure: no React, no fetch, no clock
 */
import { describe, expect, it } from "vitest";
import { ApplicationSource, ApplicationStatus } from "@/domain/application";
import { formatReceived, intakeLine, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE } from "../intake-rows";

describe("STATUS_LABEL / STATUS_TONE", () => {
  it("labels every status in plain words", () => {
    expect(ApplicationStatus.options.map((s) => STATUS_LABEL[s])).toEqual([
      "Received",
      "In pool",
      "Run started",
      "Unmatched",
      "Incomplete",
      "Held back (hourly cap)",
    ]);
  });
  it("gives every status a tone; only run-started is ok", () => {
    expect(ApplicationStatus.options.map((s) => STATUS_TONE[s])).toEqual(["neutral", "neutral", "ok", "conflict", "unsure", "unsure"]);
  });
});

describe("SOURCE_LABEL", () => {
  it("labels every source", () => {
    expect(ApplicationSource.options.map((s) => SOURCE_LABEL[s])).toEqual(["Email", "Google Form", "Apply page", "StartupJobs", "Added by hand"]);
  });
});

describe("formatReceived", () => {
  it("renders UTC date and minutes, independent of the viewer's timezone", () => {
    expect(formatReceived("2026-10-09T14:05:33.000Z")).toBe("2026-10-09 14:05");
    expect(formatReceived("2026-10-09T23:59:00+02:00")).toBe("2026-10-09 21:59");
  });
  it("returns the raw string when it does not parse", () => {
    expect(formatReceived("yesterday")).toBe("yesterday");
  });
});

describe("intakeLine", () => {
  it("reads From <source> · <tag> · <date>", () => {
    expect(intakeLine({ source: "startupjobs", tag: "senior-be", receivedAt: "2026-10-09T14:05:33.000Z" })).toBe(
      "From StartupJobs · senior-be · 2026-10-09",
    );
  });
  it("drops the tag when the application had none", () => {
    expect(intakeLine({ source: "email", tag: null, receivedAt: "2026-10-09T14:05:33.000Z" })).toBe("From Email · 2026-10-09");
  });
  it("says Added by hand without From for a candidate added on the position page", () => {
    expect(intakeLine({ source: "manual", tag: null, receivedAt: "2026-10-09T14:05:33.000Z" })).toBe("Added by hand · 2026-10-09");
  });
});
