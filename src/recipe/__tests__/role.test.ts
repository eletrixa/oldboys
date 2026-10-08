/**
 * Role seam tests: must-have question shaping, fallback, and profileFor rules.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/role.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { profileFor, roleLocation, roleQuestions, roleQuestionsFor } from "@/recipe/seams/role";
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
    expect(r.calls).toBe(1);
  });

  it("falls back to 3 generic questions and a note when the LLM fails", async () => {
    const r = await roleQuestions("Senior Data Engineer, Prague, hybrid", fakePorts());
    expect(r.questions).toHaveLength(3);
    expect(r.questions.every((q) => q.id.startsWith("mh-"))).toBe(true);
    expect(r.questions[0]?.text).toContain("Senior Data Engineer");
    expect(r.notes[0]).toContain("fallback");
    expect(r.calls).toBe(0);
    expect(r.questions[2]?.text).toBe("Location compatible with Prague (profile location)");
    expect(r.questions.map((q) => q.title)).toEqual(["Role experience", "Public work", "Location fit"]);
  });

  it("keeps the model's short title and omits a blank one", async () => {
    const ports = fakePorts({
      llm: fakeLlm(() => [
        { ...m("mh-org", "Has built or led a multi-function marketing organization?"), title: " Marketing org leadership " },
        { ...m("mh-x", "Has x?"), title: "  " },
      ]),
    });
    const r = await roleQuestions("CMO", ports);
    expect(r.questions[0]?.title).toBe("Marketing org leadership");
    expect(r.questions[1]).not.toHaveProperty("title");
  });

  it("takes the role's place, skipping work modes, else a plain-city anchor, never the whole role string", () => {
    expect(roleLocation("Senior Data Engineer, Prague, hybrid")).toBe("Prague");
    expect(roleLocation("Senior Data Engineer, remote", "Liberec")).toBe("Liberec");
    expect(roleLocation("CMO", "https://firma.cz")).toBeNull();
    expect(roleLocation("CMO", "27074358")).toBeNull();
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

describe("roleQuestionsFor", () => {
  const template = {
    key: "data-engineer",
    title: "Data Engineer",
    family: "data" as const,
    aliases: ["datový inženýr"],
    profile: "makers" as const,
    must_haves: [
      { id: "mh-pipelines", title: "Production pipelines", text: "Has built production data pipelines", accepted_evidence: ["repo", "talk"] },
      { id: "mh-warehouse", title: "Warehouse modelling", text: "Has modelled a warehouse (dbt, BigQuery)", accepted_evidence: ["repo"] },
      { id: "mh-orchestration", title: "Orchestration", text: "Has run Airflow or Dagster in production", accepted_evidence: ["repo", "blog post"] },
    ],
    sources: { steps: ["github_profile" as const, "linkedin_profile" as const, "talks_serp" as const], sites: ["github.com"] },
  };

  it("uses the matching template without a model call", async () => {
    const ports = fakePorts();
    const r = await roleQuestionsFor("Senior Data Engineer, Prague, hybrid", [template], ports);
    expect(r.template).toBe("data-engineer");
    expect(r.calls).toBe(0);
    expect(r.cost_usd).toBe(0);
    expect(ports.calls.llm).toHaveLength(0);
    expect(r.questions.map((q) => q.id)).toEqual(["mh-pipelines", "mh-warehouse", "mh-orchestration"]);
    expect(r.questions[0]?.text).toBe("Has built production data pipelines (repo, talk)");
  });

  it("falls through to the model when no template names the role", async () => {
    const ports = fakePorts({ llm: fakeLlm(() => [m("mh-x", "Has done x?")]) });
    const r = await roleQuestionsFor("Chief Happiness Wizard", [template], ports);
    expect(r.template).toBeNull();
    expect(r.calls).toBe(1);
    expect(ports.calls.llm).toHaveLength(1);
  });
});
