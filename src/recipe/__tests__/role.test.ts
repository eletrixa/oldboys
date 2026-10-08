/**
 * Role seam tests: must-have question shaping, fallback, and profileFor rules.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/role.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { profileFor, roleQuestions } from "@/recipe/seams/role";
import { fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const m = (id: string, text: string) => ({ id, text, accepted_evidence: ["repo", "talk"] });

describe("roleQuestions", () => {
  it("returns at most 5 mh- questions with evidence hints, dedupes and drops base-id collisions", async () => {
    const ports = fakePorts({
      llm: fakeLlm(() => [
        m("mh-pipeline", "Has shipped a production data pipeline?"),
        m("mh-pipeline", "duplicate"),
        m("location-match", "collides with base id"),
        m("mh-airflow", "Has worked with Airflow/dbt/Spark?"),
        m("mh-location", "Location compatible with Prague hybrid?"),
        m("mh-a", "a"),
        m("mh-b", "b"),
        m("mh-c", "c"),
      ]),
    });
    const r = await roleQuestions("Senior Data Engineer, Prague, hybrid", ports);
    expect(r.questions).toHaveLength(5);
    expect(r.questions.every((q) => q.id.startsWith("mh-") && q.text.length <= 160)).toBe(true);
    expect(r.questions.map((q) => q.id)).toEqual(["mh-pipeline", "mh-airflow", "mh-location", "mh-a", "mh-b"]);
    expect(r.questions[0]?.text).toBe("Has shipped a production data pipeline? (repo, talk)");
    expect(r.cost_usd).toBeGreaterThan(0);
  });

  it("falls back to 3 generic questions and a note when the LLM fails", async () => {
    const r = await roleQuestions("Senior Data Engineer, Prague, hybrid", fakePorts());
    expect(r.questions).toHaveLength(3);
    expect(r.questions.every((q) => q.id.startsWith("mh-"))).toBe(true);
    expect(r.questions[0]?.text).toContain("Senior Data Engineer");
    expect(r.notes[0]).toContain("fallback");
  });

  it("falls back when every returned id is unusable", async () => {
    const r = await roleQuestions("CEO", fakePorts({ llm: fakeLlm(() => [m("current-role", "x")]) }));
    expect(r.questions).toHaveLength(3);
    expect(r.notes).toHaveLength(1);
  });
});

describe("profileFor", () => {
  it.each([
    ["Senior Data Engineer, Prague", "makers"],
    ["Corporate Lawyer", "credentialed"],
    ["Registered Nurse", "credentialed"],
    ["Tax Adviser", "credentialed"],
    ["Social Media Manager", "audience"],
    ["Brand Marketing Manager", "audience"],
    ["Content Strategist", "audience"],
    ["Product Designer", "makers"],
    ["ML Researcher", "makers"],
    ["VP of Sales", "track-record"],
    ["Head of Partnerships", "track-record"],
    ["Account Executive", "track-record"],
    ["Office Administrator", "verify-only"],
    ["Sales Engineer", "makers"],
    ["Data Protection Lawyer", "credentialed"],
  ] as const)("%s -> %s", (role, expected) => {
    expect(profileFor(role)).toBe(expected);
  });
});
