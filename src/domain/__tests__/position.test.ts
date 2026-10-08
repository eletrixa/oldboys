/**
 * Tests for the Position aggregate: schemas, must-have projection to questions, dedupe key.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/position.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - One case per acceptance item A1..A12 of specs/positions-domain.md (A13 is the unchanged role.test.ts)
 *
 * Design constraints:
 * - Fixtures stay inline; A10 uses the recipe fakes to compare against roleQuestions
 */
import { describe, expect, it } from "vitest";
import { FAMILIES, Family, MustHave, mustHavesToQuestions, Position, positionDedupKey } from "@/domain/position";
import { roleQuestions } from "@/recipe/seams/role";
import { fakeLlm, fakePorts } from "@/recipe/__tests__/fakes";

const mh = (id: string, over: Partial<MustHave> = {}): MustHave => ({ id, text: `Text ${id}`, accepted_evidence: [], ...over });

const minimal = {
  id: "p1",
  title: "Senior Data Engineer",
  family: "data",
  must_haves: [],
  excerpt: "We hire.",
  ingest_method: "pasted",
  ingest_cost_usd: 0,
  created_at: "2026-10-08T10:00:00.000Z",
  expires_at: "2026-10-15T10:00:00.000Z",
};

describe("Family", () => {
  it("A1: accepts the ten values and rejects legal and empty", () => {
    expect(FAMILIES).toHaveLength(10);
    for (const f of FAMILIES) expect(Family.safeParse(f).success).toBe(true);
    expect(Family.safeParse("legal").success).toBe(false);
    expect(Family.safeParse("").success).toBe(false);
  });
});

describe("Position", () => {
  it("A2: parses a full valid object and a minimal one", () => {
    const full = {
      ...minimal,
      company: "Acme",
      location: "Prague",
      board: "greenhouse",
      posting_url: "https://boards.greenhouse.io/acme/jobs/1",
      external_id: "1",
      must_haves: [mh("mh-a", { title: "A", accepted_evidence: ["repo"] })],
      ingest_method: "greenhouse",
      ingest_cost_usd: 0.002,
    };
    expect(Position.safeParse(full).success).toBe(true);
    expect(Position.safeParse(minimal).success).toBe(true);
  });

  it("A3: rejects 6 must-haves", () => {
    const six = ["a", "b", "c", "d", "e", "f"].map((s) => mh(`mh-${s}`));
    expect(Position.safeParse({ ...minimal, must_haves: six }).success).toBe(false);
    expect(Position.safeParse({ ...minimal, must_haves: six.slice(0, 5) }).success).toBe(true);
  });

  it("A5: rejects a negative ingest_cost_usd and an unknown ingest_method", () => {
    expect(Position.safeParse({ ...minimal, ingest_cost_usd: -0.01 }).success).toBe(false);
    expect(Position.safeParse({ ...minimal, ingest_method: "scraped" }).success).toBe(false);
  });
});

describe("MustHave", () => {
  it("A4: rejects an id without the mh- prefix", () => {
    expect(MustHave.safeParse(mh("public-code")).success).toBe(false);
    expect(MustHave.safeParse(mh("mh-public-code")).success).toBe(true);
  });
});

describe("mustHavesToQuestions", () => {
  it("A6: maps 3 must-haves to 3 questions with identical ids and order", () => {
    const qs = mustHavesToQuestions({ must_haves: [mh("mh-c"), mh("mh-a"), mh("mh-b")] });
    expect(qs.map((q) => q.id)).toEqual(["mh-c", "mh-a", "mh-b"]);
  });

  it("A7: appends evidence in parentheses, plain text when empty", () => {
    const [withEv, plain] = mustHavesToQuestions({
      must_haves: [mh("mh-a", { text: "Ships pipelines", accepted_evidence: ["repo", "talk"] }), mh("mh-b", { text: "Leads teams" })],
    });
    expect(withEv?.text).toBe("Ships pipelines (repo, talk)");
    expect(plain?.text).toBe("Leads teams");
  });

  it("A8: cuts text plus evidence over 160 chars to exactly 160 ending in an ellipsis", () => {
    const [q] = mustHavesToQuestions({ must_haves: [mh("mh-a", { text: "x".repeat(170), accepted_evidence: ["repo"] })] });
    expect(q?.text).toHaveLength(160);
    expect(q?.text.endsWith("…")).toBe(true);
  });

  it("A9: trims and cuts title to 48 chars; blank title yields no title key", () => {
    const [long, blank, missing] = mustHavesToQuestions({
      must_haves: [mh("mh-a", { title: `  ${"t".repeat(60)}  ` }), mh("mh-b", { title: "   " }), mh("mh-c")],
    });
    expect(long?.title).toBe("t".repeat(48));
    expect(blank).not.toHaveProperty("title");
    expect(missing).not.toHaveProperty("title");
  });

  it("A10: equals what roleQuestions emits for the same input", async () => {
    const input = [
      mh("mh-a", { text: "Ships pipelines", title: " Pipelines ", accepted_evidence: ["repo", "talk"] }),
      mh("mh-b", { text: "y".repeat(200), accepted_evidence: ["repo"] }),
      mh("mh-c", { title: "  " }),
    ];
    const r = await roleQuestions("Senior Data Engineer", fakePorts({ llm: fakeLlm(() => input) }));
    expect(mustHavesToQuestions({ must_haves: input })).toEqual(r.questions);
  });
});

describe("positionDedupKey", () => {
  it("A11: ignores case and surrounding or repeated whitespace", () => {
    expect(positionDedupKey("Acme  s.r.o.", "Senior Data Engineer", "Prague")).toBe(
      positionDedupKey(" acme s.r.o.", "senior data engineer", "PRAGUE"),
    );
  });

  it("A12: missing company and location give empty segments", () => {
    expect(positionDedupKey(undefined, "x", undefined)).toBe("|x|");
  });
});
