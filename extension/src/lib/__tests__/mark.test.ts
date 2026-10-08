/**
 * Tests for parseProfile and markFromSelection.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/lib/__tests__/mark.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - A LinkedIn header yields subject, location anchor and a normalised profile URL
 * - Missing h1 falls back to document.title; missing location falls back to the profile URL as anchor
 * - Non-profile URLs and empty selections yield null
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { markFromSelection, parseProfile } from "../mark";

describe("parseProfile", () => {
  it("reads subject, location and the profile URL", () => {
    const mark = parseProfile(
      {
        url: "https://www.linkedin.com/in/jan-novak-1a2b3c/?originalSubdomain=cz",
        h1: " Jan Novák ",
        title: "Jan Novák - CTO - Firma | LinkedIn",
        locationLine: "Prague, Czechia",
      },
      "hiring",
    );
    expect(mark).toEqual({
      subject: "Jan Novák",
      anchor: "Prague, Czechia",
      goal: "hiring",
      sourceUrl: "https://www.linkedin.com/in/jan-novak-1a2b3c",
    });
  });

  it("falls back to the title when the h1 is missing and to the URL when the location is missing", () => {
    const mark = parseProfile(
      { url: "https://cz.linkedin.com/in/jan-novak", h1: null, title: "Jan Novák - CTO | LinkedIn", locationLine: "" },
      "due-diligence",
    );
    expect(mark).toMatchObject({ subject: "Jan Novák", anchor: "https://cz.linkedin.com/in/jan-novak", goal: "due-diligence" });
  });

  it("returns null off profile pages", () => {
    expect(parseProfile({ url: "https://www.linkedin.com/feed/", h1: "Feed", title: "Feed", locationLine: null }, "hiring")).toBeNull();
  });
});

describe("markFromSelection", () => {
  it("uses the selection as subject and the hostname as anchor", () => {
    expect(markFromSelection("Jana Nováková", "https://firma.cz/team?x=1", "hiring")).toEqual({
      subject: "Jana Nováková",
      anchor: "firma.cz",
      goal: "hiring",
      sourceUrl: "https://firma.cz/team?x=1",
    });
  });

  it("returns null for an empty selection or a bad URL", () => {
    expect(markFromSelection("   ", "https://firma.cz", "hiring")).toBeNull();
    expect(markFromSelection("Jana", "not a url", "hiring")).toBeNull();
  });
});
