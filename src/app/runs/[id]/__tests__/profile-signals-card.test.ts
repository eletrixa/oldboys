/**
 * Tests for the Profile signals card and its text helpers: sentence, source link, ask, not-checked, caveats, null and empty cases.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/profile-signals-card.test.ts
 * Deps:    vitest, react-dom/server
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - ProfileSignalsCard markup with a fixture; null renders nothing; zero signals renders the honesty line
 * - signalLines / askLines content and order
 *
 * Design constraints:
 * - Pure: synthetic fixture, no I/O
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PROFILE_SIGNAL_CAVEATS, type ProfileSignals } from "@/domain/profile-signals";
import { ProfileSignalsCard } from "../profile-signals-card";
import { askLines, signalLines } from "../profile-signals-text";

const ps: ProfileSignals = {
  signals: [
    {
      id: "young-account", platform: "github", profile_url: "https://github.com/jnovak",
      text: "The GitHub account was created on 2 Mar 2026.", source_url: "https://api.github.com/users/jnovak",
      ask: "Did you have an earlier GitHub account?",
    },
    {
      id: "linkedin-verified", platform: "linkedin", profile_url: "https://www.linkedin.com/in/jnovak",
      text: "The LinkedIn profile shows a verified badge.", source_url: "https://www.linkedin.com/in/jnovak", ask: null,
    },
    {
      id: "forks-only", platform: "github", profile_url: "https://github.com/jnovak",
      text: "All public repositories are forks.", source_url: "javascript:alert(1)", ask: "Did you have an earlier GitHub account?",
    },
  ],
  not_checked: ["LinkedIn does not publish the account creation date without login."],
  checked: ["github", "linkedin"],
};

const html = (s: ProfileSignals | null | undefined): string => renderToStaticMarkup(createElement(ProfileSignalsCard, { signals: s }));

describe("ProfileSignalsCard", () => {
  it("renders sentences, source link, ask, not-checked and caveats", () => {
    const out = html(ps);
    expect(out).toContain("The GitHub account was created on 2 Mar 2026.");
    expect(out).toContain('href="https://api.github.com/users/jnovak"');
    expect(out).toContain('rel="noreferrer"');
    expect(out).toContain("Ask: Did you have an earlier GitHub account?");
    expect(out).toContain("Not checked");
    expect(out).toContain("LinkedIn does not publish the account creation date without login.");
    for (const c of PROFILE_SIGNAL_CAVEATS) expect(out).toContain(c.replaceAll("'", "&#x27;"));
  });

  it("drops a non-http source link", () => {
    expect(html(ps)).not.toContain("javascript:");
  });

  it("renders nothing for null or undefined", () => {
    expect(html(null)).toBe("");
    expect(html(undefined)).toBe("");
  });

  it("states zero signals and still shows not-checked and caveats", () => {
    const out = html({ signals: [], not_checked: ["X: no facts"], checked: [] });
    expect(out).toContain("No account signals on this run.");
    expect(out).toContain("X: no facts");
    expect(out).toContain(PROFILE_SIGNAL_CAVEATS[0]);
  });
});

describe("signalLines / askLines", () => {
  it("lists sentences with sources, then not-checked, then caveats", () => {
    const lines = signalLines(ps);
    expect(lines[0]).toBe("The GitHub account was created on 2 Mar 2026. (source: https://api.github.com/users/jnovak)");
    expect(lines[2]).toBe("All public repositories are forks.");
    expect(lines[3]).toBe("Not checked: LinkedIn does not publish the account creation date without login.");
    expect(lines.slice(4)).toEqual([...PROFILE_SIGNAL_CAVEATS]);
  });

  it("returns the distinct asks only", () => {
    expect(askLines(ps)).toEqual(["Did you have an earlier GitHub account?"]);
    expect(askLines(null)).toEqual([]);
    expect(signalLines(null)).toEqual([]);
  });
});
