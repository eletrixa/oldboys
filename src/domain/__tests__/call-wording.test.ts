/**
 * Tests for the spoken wording of proposed call questions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/call-wording.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Must-haves: third-person question to second person, title template otherwise, untitled statements
 * - To verify: name to "you"/"your", first clause, past-tense lead, unclean texts kept
 * - The live-call examples of 2026-10-09 read as natural questions
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { describe, expect, it } from "vitest";
import { mustHaveQuestion, secondPerson, subjectRefs, toVerifyQuestion } from "@/domain/call-wording";

const refs = subjectRefs("Robert Vojáček");

describe("subjectRefs", () => {
  it("lists the candidate, full name, first name and ASCII forms, longest first", () => {
    expect(refs).toEqual(["Robert Vojáček", "Robert Vojacek", "the candidate", "Robert"]);
  });

  it("uses only the candidate for a one-word or empty subject", () => {
    expect(subjectRefs("Jane")).toEqual(["the candidate", "Jane"]);
    expect(subjectRefs("  ")).toEqual(["the candidate"]);
  });
});

describe("secondPerson", () => {
  it.each([
    ["Does the candidate have Go backend experience?", "Do you have Go backend experience?"],
    ["Has the candidate shipped their own mobile app?", "Have you shipped your own mobile app?"],
    ["Is the candidate based in Prague?", "Are you based in Prague?"],
    ["Can the candidate show public code in Rust?", "Can you show public code in Rust?"],
    ["Was Robert Vojacek a team lead?", "Were you a team lead?"],
    ["Has Robert led a team of 5+ people?", "Have you led a team of 5+ people?"],
    ["Does the candidate list the candidate's certifications?", "Do you list your certifications?"],
  ])("%s → %s", (input, out) => {
    expect(secondPerson(input, refs)).toBe(out);
  });

  it("refuses a statement, an unknown verb or a third person left in the question", () => {
    expect(secondPerson("Prior cleaning experience", refs)).toBeNull();
    expect(secondPerson("Should the candidate know SQL?", refs)).toBeNull();
    expect(secondPerson("Has the candidate led a team where they hired?", refs)).toBeNull();
    expect(secondPerson("Does the candidate work with the candidate's team?", refs)).toBe("Do you work with your team?");
  });

  it("never treats a lower-case word as the first name", () => {
    expect(secondPerson("Does mark have it?", subjectRefs("Mark Twain"))).toBeNull();
  });
});

describe("mustHaveQuestion", () => {
  it("asks the live-call cleaning must-have naturally", () => {
    expect(mustHaveQuestion({ title: "Prior cleaning experience", text: "Prior cleaning experience (job history)", coverage: "none", refs })).toBe(
      "Can you tell me about your prior cleaning experience?",
    );
  });

  it("converts a third-person question behind the evidence list", () => {
    expect(mustHaveQuestion({ title: "Go backend", text: "Does the candidate have Go backend experience? (repo, talk)", coverage: "none", refs })).toBe(
      "Do you have Go backend experience?",
    );
  });

  it("uses the title for partial evidence and keeps acronyms and single words", () => {
    expect(mustHaveQuestion({ title: "Team leadership", text: "Led a team at a named employer", coverage: "partial", refs })).toBe(
      "Can you tell me a bit more about your team leadership?",
    );
    expect(mustHaveQuestion({ title: "UX case studies", text: "Publishes UX case studies", coverage: "none", refs })).toBe("Can you tell me about your UX case studies?");
    expect(mustHaveQuestion({ title: "Kubernetes", text: "Kubernetes in production", coverage: "partial", refs })).toBe(
      "Can you tell me a bit more about your Kubernetes?",
    );
  });

  it("falls back to the title when the stored text was cut", () => {
    expect(mustHaveQuestion({ title: "Go backend", text: "Does the candidate have five years of Go backend experience at a…", coverage: "none", refs })).toBe(
      "Can you tell me about your Go backend?",
    );
  });

  it("asks an untitled statement as a question", () => {
    expect(mustHaveQuestion({ text: "Has held a Cleaner position or equivalent (job history, profile)", coverage: "none", refs })).toBe(
      "Have you held a Cleaner position or equivalent?",
    );
    expect(mustHaveQuestion({ text: "Location compatible with Prague", coverage: "partial", refs })).toBe(
      "Can you tell me about this point: location compatible with Prague?",
    );
  });
});

describe("toVerifyQuestion", () => {
  it("shortens the live-call Revolt.BI item to its first clause and speaks to the candidate", () => {
    const text =
      "A former Revolt.BI team member thanked Robert Vojacek for the opportunity at Revolt.BI, consistent with him having a leadership/hiring role there";
    expect(toVerifyQuestion(text, refs)).toBe("We read that a former Revolt.BI team member thanked you for the opportunity at Revolt.BI. Is that right?");
  });

  it.each([
    ["Led a team of five at Acme", "We read that you led a team of five at Acme. Is that right?"],
    ["Robert Vojáček's GitHub shows Python projects since 2015", "We read that your GitHub shows Python projects since 2015. Is that right?"],
    ["Robert Vojacek was CTO at Revolt.BI between 2018 and 2021", "We read that you were CTO at Revolt.BI between 2018 and 2021. Is that right?"],
    ["Acme lists Robert as a co-founder; the register disagrees", "We read that Acme lists you as a co-founder. Is that right?"],
    ["Has spoken at PyCon CZ twice", "We read that you have spoken at PyCon CZ twice. Is that right?"],
  ])("%s", (input, out) => {
    expect(toVerifyQuestion(input, refs)).toBe(out);
  });

  it("keeps the name when 'you' would break the grammar", () => {
    expect(toVerifyQuestion("Robert Vojacek works at Acme as a data engineer.", refs)).toBe(
      "We read that Robert Vojacek works at Acme as a data engineer. Is that right?",
    );
  });

  it("keeps a text that cannot be cut cleanly, without a research prefix", () => {
    const cv = "CV: Senior engineer at Acme 2019-2021. Public LinkedIn: Engineer at Acme 2020-2021.";
    expect(toVerifyQuestion(cv, refs)).toBe("CV: Senior engineer at Acme 2019-2021. Public LinkedIn: Engineer at Acme 2020-2021. Is that right?");
    const long = `Robert Vojacek maintained ${"several open-source data tools ".repeat(5).trim()}`;
    expect(toVerifyQuestion(long, refs)).toBe(`You maintained ${"several open-source data tools ".repeat(5).trim()}. Is that right?`);
  });

  it("leaves names alone without refs (due-diligence)", () => {
    expect(toVerifyQuestion("Acme s.r.o. was founded in 2015", [])).toBe("We read that Acme s.r.o. was founded in 2015. Is that right?");
  });
});
