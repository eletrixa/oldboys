/**
 * Tests for the profile-suggest query builder and SERP hit parser (plans/011).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/profile-suggest.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - Query shape with and without a hint; quotes stripped
 * - Title parse: hyphen, en dash, pipe, missing suffix, bare name
 * - Hits: non-profile URLs dropped, country hosts and tracking params deduped, unparseable title keeps the handle, cap
 *
 * Design constraints:
 * - Pure
 */
import { describe, expect, it } from "vitest";
import { parseProfileTitle, suggestionsFromHits, suggestQuery } from "../profile-suggest";

describe("suggestQuery", () => {
  it("quotes the name and appends the hint", () => {
    expect(suggestQuery("  Jan  Novák ", "Seznam")).toBe('site:linkedin.com/in "Jan Novák" Seznam');
    expect(suggestQuery("Jan Novák")).toBe('site:linkedin.com/in "Jan Novák"');
  });
  it("strips quotes the user typed", () => {
    expect(suggestQuery('"Jan" Novák', '"Brno"')).toBe('site:linkedin.com/in "Jan Novák" Brno');
  });
});

describe("parseProfileTitle", () => {
  it("splits name, headline and company", () => {
    expect(parseProfileTitle("Jan Novák - Data Engineer - Seznam.cz | LinkedIn")).toEqual({ name: "Jan Novák", headline: "Data Engineer · Seznam.cz" });
  });
  it("accepts en dashes and a dash before the suffix", () => {
    expect(parseProfileTitle("Jan Novák – Data Engineer – LinkedIn")).toEqual({ name: "Jan Novák", headline: "Data Engineer" });
  });
  it("handles a bare name with or without the suffix", () => {
    expect(parseProfileTitle("Jan Novák | LinkedIn")).toEqual({ name: "Jan Novák", headline: "" });
    expect(parseProfileTitle("Jan Novák")).toEqual({ name: "Jan Novák", headline: "" });
    expect(parseProfileTitle("")).toEqual({ name: "", headline: "" });
  });
});

describe("suggestionsFromHits", () => {
  const hits = [
    { title: "Jan Novák - Data Engineer - Seznam | LinkedIn", url: "https://cz.linkedin.com/in/jan-novak-1a2b?trk=public", description: "Praha.  Data  engineer." },
    { title: "Seznam.cz | LinkedIn", url: "https://www.linkedin.com/company/seznam-cz" },
    { title: "Jan Novák - Data Engineer - Seznam | LinkedIn", url: "https://www.linkedin.com/in/jan-novak-1a2b" },
    { title: "Post by Jan", url: "https://www.linkedin.com/posts/jan-novak_data-activity-1" },
    { title: "", url: "https://linkedin.com/in/jan-novak-77" },
    { title: "Top 10 Jan Novák profiles | LinkedIn", url: "https://www.linkedin.com/pub/dir/Jan/Novak" },
  ];

  it("keeps only profile URLs, deduped and normalised, and keeps order", () => {
    expect(suggestionsFromHits(hits)).toEqual([
      { url: "https://www.linkedin.com/in/jan-novak-1a2b", name: "Jan Novák", headline: "Data Engineer · Seznam", snippet: "Praha. Data engineer." },
      { url: "https://www.linkedin.com/in/jan-novak-77", name: "Jan Novak", headline: "", snippet: "" },
    ]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `P ${String(i)} | LinkedIn`, url: `https://www.linkedin.com/in/p-${String(i)}` }));
    expect(suggestionsFromHits(many)).toHaveLength(8);
    expect(suggestionsFromHits(many, 3)).toHaveLength(3);
  });
});
