/**
 * Tests for the intake queue's pure helpers: status and source labels, row shaping, dates, the run-page line.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/intake/__tests__/intake-rows.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - statusLabel / statusTone cover every ApplicationStatus; sourceLabel every ApplicationSource
 * - formatReceived: UTC "YYYY-MM-DD HH:MM", the raw string when unparseable
 * - shapeRow: run link only with a run id, name/email fallbacks, truncated note with the full text kept
 * - intakeLine: "From <source> · <tag> · <date>", tag omitted when absent
 *
 * Design constraints:
 * - Pure: no React, no fetch, no clock
 */
import { describe, expect, it } from "vitest";
import { ApplicationSource, ApplicationStatus } from "@/domain/application";
import { type ApplicationListRow, formatReceived, intakeLine, NOTE_MAX, shapeRow, sourceLabel, statusLabel, statusTone } from "../intake-rows";

const row = (over: Partial<ApplicationListRow> = {}): ApplicationListRow => ({
  id: "a1",
  source: "email",
  external_id: "<m1@x>",
  tag: "senior-be",
  name: "Eva Nováková",
  email: "eva@example.cz",
  linkedin_url: "https://www.linkedin.com/in/eva",
  cv_key: "intake/a1/cv.pdf",
  status: "run-started",
  run_id: "r1",
  note: null,
  received_at: "2026-10-09T14:05:33.000Z",
  ...over,
});

describe("statusLabel / statusTone", () => {
  it("labels every status in plain words", () => {
    expect(ApplicationStatus.options.map(statusLabel)).toEqual([
      "Received",
      "Run started",
      "Unmatched",
      "Incomplete",
      "Held back (hourly cap)",
    ]);
  });
  it("gives every status a tone; only run-started is ok", () => {
    expect(ApplicationStatus.options.map(statusTone)).toEqual(["neutral", "ok", "conflict", "unsure", "unsure"]);
  });
});

describe("sourceLabel", () => {
  it("labels every source", () => {
    expect(ApplicationSource.options.map(sourceLabel)).toEqual(["Email", "Google Form", "Apply page", "StartupJobs"]);
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

describe("shapeRow", () => {
  it("links the run only when a run exists", () => {
    expect(shapeRow(row()).runHref).toBe("/runs/r1");
    expect(shapeRow(row({ run_id: null, status: "unmatched" })).runHref).toBeNull();
  });
  it("shapes the visible columns", () => {
    expect(shapeRow(row())).toMatchObject({
      id: "a1",
      received: "2026-10-09 14:05",
      tag: "senior-be",
      source: "Email",
      name: "Eva Nováková",
      email: "eva@example.cz",
      status: "Run started",
      tone: "ok",
    });
  });
  it("falls back for missing tag, name and email, and never returns CV or cover letter fields", () => {
    const shaped = shapeRow(row({ tag: null, name: null, email: null }));
    expect(shaped).toMatchObject({ tag: null, name: "(no name)", email: null });
    expect(Object.keys(shaped)).not.toContain("cv_text");
    expect(Object.keys(shaped)).not.toContain("cover_letter");
  });
  it("truncates a long note but keeps the full text for the tooltip", () => {
    const long = "x".repeat(NOTE_MAX + 40);
    const shaped = shapeRow(row({ note: long }));
    expect(shaped.note).toBe(`${"x".repeat(NOTE_MAX)}…`);
    expect(shaped.noteFull).toBe(long);
    expect(shapeRow(row({ note: "short" }))).toMatchObject({ note: "short", noteFull: "short" });
    expect(shapeRow(row())).toMatchObject({ note: null, noteFull: null });
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
});
