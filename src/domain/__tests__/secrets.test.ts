/**
 * Tests for missingSecrets: empty, blank and absent keys are reported by name, set keys are not.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/secrets.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { missingSecrets } from "@/domain/secrets";

describe("missingSecrets", () => {
  it("returns nothing when both keys are set", () => {
    expect(missingSecrets({ APIFY_TOKEN: "apify_api_x", ANTHROPIC_API_KEY: "sk-ant-x" })).toEqual([]);
  });

  it("reports an empty APIFY_TOKEN", () => {
    expect(missingSecrets({ APIFY_TOKEN: "", ANTHROPIC_API_KEY: "sk-ant-x" })).toEqual(["APIFY_TOKEN is not set"]);
  });

  it("reports a blank or absent ANTHROPIC_API_KEY, and both when both are missing", () => {
    expect(missingSecrets({ APIFY_TOKEN: "apify_api_x", ANTHROPIC_API_KEY: "  " })).toEqual(["ANTHROPIC_API_KEY is not set"]);
    expect(missingSecrets({})).toEqual(["APIFY_TOKEN is not set", "ANTHROPIC_API_KEY is not set"]);
  });
});
