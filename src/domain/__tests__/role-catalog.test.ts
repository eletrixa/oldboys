/**
 * Role catalog tests: catalog integrity (100+ roles, valid must-haves, evidence plan), matcher, row round trip, seed migration.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/role-catalog.test.ts
 * Deps:    vitest, node:fs
 * Tested:  n/a (this is the test)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_IDS, FAMILIES, MustHaves } from "@/domain/position";
import { filterRoleOptions, HIRING_EVIDENCE_STEPS, matchRoleTemplate, normalizeRoleTitle, ROLE_CATALOG, ROLE_OPTIONS, ROLE_TITLES, roleSitesQuery, templateFromRow, templateToRow } from "@/domain/role-catalog";
import { hiringRecipe } from "@/recipe/goals/hiring";

// GDPR Art. 9 and the brief's banned scores; "health insurance" (payroll) and "Medical Chamber" (register) are role facts, not inferences.
const FORBIDDEN = /\b(health (?:condition|status|record)|disabilit|religio|politic|ethnic|racial|sexual|orientation|pregnan|marital|personality|trustworth|credit score|culture fit|\bage\b|young|old\b)/i;
const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/;

describe("ROLE_CATALOG", () => {
  it("has at least 100 roles with unique keys and titles across every family", () => {
    expect(ROLE_CATALOG.length).toBeGreaterThanOrEqual(100);
    const keys = ROLE_CATALOG.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(ROLE_TITLES.map((t) => t.toLowerCase())).size).toBe(ROLE_TITLES.length);
    for (const family of FAMILIES) expect(ROLE_CATALOG.some((t) => t.family === family), family).toBe(true);
  });

  it.each(ROLE_CATALOG.map((t) => [t.key, t] as const))("%s is well formed", (_key, t) => {
    expect(t.key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(t.title.trim()).toBe(t.title);
    expect(t.aliases.length).toBeGreaterThanOrEqual(2);
    for (const a of t.aliases) {
      expect(a).toBe(a.toLowerCase().trim());
      expect(a).not.toBe(t.title.toLowerCase());
    }
    const mh = MustHaves.parse(t.must_haves);
    expect(mh.length).toBeGreaterThanOrEqual(3);
    expect(new Set(mh.map((m) => m.id)).size).toBe(mh.length);
    for (const m of mh) {
      expect(BASE_IDS.has(m.id)).toBe(false);
      expect(m.text.length).toBeLessThanOrEqual(120);
      expect(m.accepted_evidence.length).toBeGreaterThanOrEqual(1);
      expect(`${m.text} ${m.title ?? ""}`).not.toMatch(FORBIDDEN);
    }
    expect(t.sources.steps.length).toBeGreaterThanOrEqual(3);
    expect(new Set(t.sources.steps).size).toBe(t.sources.steps.length);
    for (const s of t.sources.steps) {
      expect(HIRING_EVIDENCE_STEPS).toContain(s);
      expect(hiringRecipe.steps.some((x) => x.id === s), s).toBe(true);
    }
    expect(t.sources.sites.length).toBeGreaterThanOrEqual(2);
    expect(t.sources.sites.length).toBeLessThanOrEqual(5);
    for (const d of t.sources.sites) expect(d).toMatch(DOMAIN);
  });

  it("no alias is claimed by two templates", () => {
    const owner = new Map<string, string>();
    for (const t of ROLE_CATALOG) {
      for (const name of [t.title.toLowerCase(), ...t.aliases]) {
        expect(owner.get(name) ?? t.key, `"${name}" is in ${owner.get(name) ?? ""} and ${t.key}`).toBe(t.key);
        owner.set(name, t.key);
      }
    }
  });

  it("is seeded by migration 0013 (every key, INSERT OR REPLACE)", () => {
    const sql = readFileSync("migrations/0013_role_templates.sql", "utf8");
    for (const t of ROLE_CATALOG) expect(sql, t.key).toContain(`VALUES ('${t.key}', `);
    expect(sql).toContain("CREATE TABLE role_templates");
    expect(sql).toContain("ALTER TABLE investigations ADD COLUMN role_template");
  });
});

describe("matchRoleTemplate", () => {
  it("normalises levels, gender tags and the location tail", () => {
    expect(normalizeRoleTitle("Senior Data Engineer, Prague, hybrid")).toBe("data engineer");
    expect(normalizeRoleTitle("Backend Engineer (m/f) II")).toBe("backend engineer");
    expect(normalizeRoleTitle("  Lead  UX Designer – Brno ")).toBe("ux designer");
  });

  it("matches the canonical title, an alias, a Czech alias and a contained phrase", () => {
    const keyOf = (role: string): string | null => matchRoleTemplate(role, ROLE_CATALOG)?.key ?? null;
    expect(keyOf("Senior Data Engineer, Prague, hybrid")).toBe("data-engineer");
    expect(keyOf("Datový inženýr")).toBe("data-engineer");
    expect(keyOf("Product Designer")).toBe(ROLE_CATALOG.find((t) => t.title === "Product Designer")?.key ?? "");
    expect(keyOf("Backend Engineer (Go)")).toBe(matchRoleTemplate("backend engineer", ROLE_CATALOG)?.key ?? "");
    expect(keyOf("Chief Happiness Wizard")).toBeNull();
    expect(keyOf("")).toBeNull();
  });

  it("every catalog title matches its own template, level words and brackets included", () => {
    const wrong = ROLE_CATALOG.filter((t) => matchRoleTemplate(t.title, ROLE_CATALOG)?.key !== t.key).map((t) => t.title);
    expect(wrong).toEqual([]);
    const keyOf = (role: string): string | null => matchRoleTemplate(role, ROLE_CATALOG)?.key ?? null;
    expect(keyOf("Senior Product Manager, Prague")).toBe("senior-product-manager");
    expect(keyOf("Tech Lead (m/ž)")).toBe("tech-lead");
    expect(keyOf("Product Manager II ")).toBe("product-manager");
  });

  it("prefers the longest alias on containment", () => {
    const t = [
      { key: "engineer", title: "Engineer", aliases: [] },
      { key: "data-engineer", title: "Data Engineer", aliases: ["datový inženýr"] },
    ];
    expect(matchRoleTemplate("Senior Data Engineer (Spark)", t)?.key).toBe("data-engineer");
    expect(matchRoleTemplate("Engineer", t)?.key).toBe("engineer");
  });
});

describe("rows", () => {
  it("round-trips through the D1 row shape and rejects broken JSON", () => {
    const t = ROLE_CATALOG[0];
    if (t === undefined) throw new Error("empty catalog");
    expect(templateFromRow(templateToRow(t))).toEqual(t);
    expect(templateFromRow({ ...templateToRow(t), must_haves_json: "{" })).toBeNull();
    expect(templateFromRow({ ...templateToRow(t), sources_json: '{"steps":[]}' })).toBeNull();
  });

  it("builds the site: clause", () => {
    expect(roleSitesQuery(["github.com", "npmjs.com"])).toBe("site:github.com OR site:npmjs.com");
    expect(roleSitesQuery([])).toBe("");
  });
});

describe("filterRoleOptions", () => {
  it("ranks title prefix, then title, then alias, then family; empty query lists the first options", () => {
    expect(filterRoleOptions("", ROLE_OPTIONS, 3).map((o) => o.title)).toEqual(ROLE_TITLES.slice(0, 3));
    const data = filterRoleOptions("data eng", ROLE_OPTIONS).map((o) => o.title);
    expect(data[0]).toBe("Data Engineer");
    expect(filterRoleOptions("datový inž", ROLE_OPTIONS)[0]?.title).toBe("Data Engineer");
    const design = filterRoleOptions("design", ROLE_OPTIONS, 200);
    expect(design.length).toBeGreaterThan(5);
    expect(design.every((o) => o.family === "design" || /design/i.test(o.title) || o.aliases.some((a) => a.includes("design")))).toBe(true);
    expect(filterRoleOptions("chief happiness wizard", ROLE_OPTIONS)).toEqual([]);
    expect(filterRoleOptions("ux", ROLE_OPTIONS, 2)).toHaveLength(2);
  });
});
