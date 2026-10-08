/**
 * Name + employer corroboration and the professional-only lineup filter.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/corroborate.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import {
  corroborationReason,
  headlineOrgs,
  mentionsFullName,
  mentionsPlace,
  orgTokens,
  placeOf,
  professionalReasons,
  professionalSnippet,
} from "@/domain/corroborate";

const SUBJECT = "Josef Buryan";
const tokens = orgTokens(["Groupon", "Meta", "Vilgain s.r.o.", "M+C Group Limited", "Buryan Consulting"], SUBJECT);
const page = (excerpt: string, url = "https://example.com/news") => ({ url, excerpt });

describe("orgTokens", () => {
  it("keeps distinctive words, drops generic words, short tokens and the subject's own name", () => {
    expect(tokens.map((t) => t.token)).toEqual(["groupon", "meta", "vilgain"]);
  });
});

describe("mentionsFullName", () => {
  it("matches both orders, any case, with or without diacritics", () => {
    expect(mentionsFullName(SUBJECT, "said JOSEF BURYAN, CMO")).toBe(true);
    expect(mentionsFullName(SUBJECT, "Buryan, Josef - Groupon")).toBe(true);
    expect(mentionsFullName(SUBJECT, "Josef Buryán")).toBe(true);
    expect(mentionsFullName(SUBJECT, "https://x.cz/josef-buryan")).toBe(true);
  });
  it("needs the full name, not a part of it", () => {
    expect(mentionsFullName(SUBJECT, "Mr Buryan of Groupon")).toBe(false);
    expect(mentionsFullName(SUBJECT, "Josef Buryanek")).toBe(false);
    expect(mentionsFullName("Buryan", "Buryan Groupon")).toBe(false);
  });
});

describe("corroborationReason", () => {
  it("merges a Saatchi-style quote: full name and employer", () => {
    expect(corroborationReason(SUBJECT, tokens, page("Josef Buryan, CMO at Groupon, said the campaign..."))).toBe("name and employer match (Groupon)");
  });
  it("rejects a namesake: full name without any employer token", () => {
    expect(corroborationReason(SUBJECT, tokens, page("Josef Buryan, dentist in Brno"))).toBeNull();
  });
  it("rejects an employer mention without the name", () => {
    expect(corroborationReason(SUBJECT, tokens, page("Groupon launches Turn Life On campaign"))).toBeNull();
  });
  it("matches diacritics and reversed order", () => {
    expect(corroborationReason(SUBJECT, tokens, page("Josef Buryán vede marketing Grouponu", "https://groupon.com/team"))).toBe("name and employer match (Groupon)");
    expect(corroborationReason(SUBJECT, tokens, page("Buryan Josef | CMO, Vilgain"))).toBe("name and employer match (Vilgain)");
  });
  it("matches Meta only as a whole word", () => {
    expect(corroborationReason(SUBJECT, tokens, page("Josef Buryan on metadata pipelines"))).toBeNull();
    expect(corroborationReason(SUBJECT, tokens, page("Josef Buryan, formerly at Meta"))).toBe("name and employer match (Meta)");
  });
  it("never counts the subject's own surname in a company name as an employer", () => {
    expect(corroborationReason(SUBJECT, tokens, page("Josef Buryan, Buryan Consulting, Brno"))).toBeNull();
  });
});

describe("headlineOrgs", () => {
  it("reads ex-, @ and at organisations", () => {
    expect(headlineOrgs("CMO, Groupon (NASDAQ: GRPN) | AI-Native Marketing | ex-Meta")).toEqual(["Meta"]);
    expect(headlineOrgs("Data Engineer at Kiwi.com")).toEqual(["Kiwi.com"]);
  });
});

describe("place", () => {
  it("takes the first segment of a city anchor, none for URL or IČO", () => {
    expect(placeOf("Prague, Czechia")).toBe("prague");
    expect(placeOf("groupon.com")).toBeNull();
    expect(placeOf("27082440")).toBeNull();
    expect(mentionsPlace("Prague, Czechia", "CMO based in Prague")).toBe(true);
    expect(mentionsPlace("Brno", "Brnox")).toBe(false);
  });
});

describe("professional-only lineup text", () => {
  it("drops reasons citing check-ins, profile pictures, family and hobbies", () => {
    const reasons = ["Handle matches name", "Prague check-ins on 31 Jan and 1 Feb 2025", "Profile-picture updates", "Bio says Dad, Rugby Addict", "Employer Groupon in bio"];
    expect(professionalReasons(reasons)).toEqual(["Handle matches name", "Employer Groupon in bio"]);
  });
  it("strips personal segments from a snippet and keeps professional ones", () => {
    expect(professionalSnippet("Josef Buryan | Dad, Rugby Addict | CMO Groupon")).toBe("Josef Buryan | CMO Groupon");
    expect(professionalSnippet("CMO, Groupon · Prague")).toBe("CMO, Groupon · Prague");
  });
});
