/**
 * Tests for the shared GDPR Art. 9 denylist.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/art9.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - English and Czech stems match at word start, neutral text passes
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { ART9_PATTERN, containsArt9Topic } from "@/domain/art9";

describe("containsArt9Topic", () => {
  it("flags English and Czech topics case-insensitively", () => {
    expect(containsArt9Topic("Their Religious beliefs")).toBe(true);
    expect(containsArt9Topic("any medical condition?")).toBe(true);
    expect(containsArt9Topic("she is pregnant")).toBe(true);
    expect(containsArt9Topic("attends church weekly")).toBe(true);
    expect(containsArt9Topic("voted in the election")).toBe(true);
    expect(containsArt9Topic("zdravotní stav")).toBe(true);
    expect(containsArt9Topic("člen odborů")).toBe(true);
    expect(containsArt9Topic("odborová organizace")).toBe(true);
    expect(containsArt9Topic("dlouhodobá nemoc")).toBe(true);
    expect(containsArt9Topic("politické názory")).toBe(true);
    expect(containsArt9Topic("etnický původ")).toBe(true);
    expect(containsArt9Topic("sexuální orientace")).toBe(true);
    expect(containsArt9Topic("náboženství")).toBe(true);
  });

  it("passes neutral text, including words that merely contain a stem", () => {
    expect(containsArt9Topic("What is the current role and employer?")).toBe(false);
    expect(containsArt9Topic("Which third party audited the accounts?")).toBe(false);
    expect(containsArt9Topic("Can you trace the ownership and embrace the deal?")).toBe(false);
    expect(containsArt9Topic("Is the account disabled?")).toBe(true);
    expect(containsArt9Topic("odborné zkušenosti v logistice, odborník na SAP")).toBe(false);
    expect(containsArt9Topic("pracuje v Nemocnici Motol jako zdravotník")).toBe(false);
    expect(containsArt9Topic("CTO at a medical device company with strong customer orientation")).toBe(false);
    expect(ART9_PATTERN.flags).toContain("u");
  });
});
