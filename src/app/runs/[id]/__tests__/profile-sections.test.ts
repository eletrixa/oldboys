/**
 * Tests for the enriched profile on the report page: evidence disclosures, weakens marker, missing source, degraded line.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 * Deps:    vitest, react, react-dom/server (static markup, no DOM)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Verdict strip, Robert's section order, caps with "Show N more", run's role first, empty sections omitted
 * - Evidence lines: kind, direction, strength pill, [n] deep link, note, "source missing"; independent count per item
 * - Fit recomputed as Σ(weight × status) ÷ Σ(weight)
 * - A degraded profile renders only "Profile not built: <reason>"
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type HistoryEntry, type PositionFit, Profile, type ProfileEvidence } from "@/domain/claim";
import { evidenceOf } from "../evidence";
import { ProfileSections } from "../profile-sections";

const ev = (over: Partial<ProfileEvidence> = {}): ProfileEvidence => ({ quote: "led the data team at Acme", source_id: "s1", kind: "FACT", supports: true, note: "", strength: "weak", ...over });

const acme: HistoryEntry = { organization: "Acme", title: "Data lead", from: "2019", to: null, kind: "job", summary: "Runs data", location: "", duration: "", evidence: [ev()] };
const cto: PositionFit = {
  role: "CTO",
  fit_pct: 75,
  traits: [
    { trait: "Leads teams", status: "has", weight: 1, evidence: [ev()] },
    { trait: "Budget", status: "none", weight: 1, evidence: [] },
  ],
  rationale: "Strong lead.",
};

// Parsed so schema defaults (e.g. dropped-evidence counts) fill in.
const profile = Profile.parse({
  achievements: [{ text: "Built Acme's data platform", evidence: [ev()] }],
  risks: [{ text: "Short tenures", evidence: [ev({ supports: false, kind: "INFERENCE" }), ev({ source_id: "gone" })] }],
  history: [
    { organization: "CTU", title: "MSc", from: "2010", to: "2012", kind: "education", summary: "", evidence: [] },
    acme,
  ],
  personality: { disc: { type: "C", confidence: "low" }, mbti: null, read: "Writes precisely.", evidence: [ev({ kind: "INFERENCE" })], evidence_dropped: 2 },
  position_fit: [cto],
  questions: [{ text: "Why leave Acme?", closes: "Short tenures" }],
  degraded: null,
  risks_dropped: 1,
});

const evidence = evidenceOf({ sources: [{ id: "s1", url: "https://example.com/about", fetched_at: "2026-10-09T10:00:00Z" }] });
const html = (p: Profile): string => renderToStaticMarkup(createElement(ProfileSections, { profile: p, evidence, role: "CTO" }));

const many = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ text: `${prefix} ${String(i + 1)}`, detail: "", evidence: [ev()] }));

describe("ProfileSections", () => {
  it("renders the summary box, then sections in Robert's order, then sources", () => {
    const out = html(profile);
    const order = ["Profile at a glance", "1. Achievements", "2. Risks", "3. History", "4. Working style", "5. Position fit", "6. What to ask", "Sources (1)"].map((t) =>
      out.indexOf(t),
    );
    expect(order[0]).toBeGreaterThanOrEqual(0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(out).toContain("Data lead, Acme");
    expect(out).toContain("1 of 2 must-haves evidenced");
    expect(out).toContain("Current role");
    expect(out).toContain(">4 · 2<");
    expect(out).toContain("from 1 source");
    expect(out).toContain("closes: <span class=\"text-ink\">Short tenures</span>");
    expect(out).toContain("Inference from public writing, not an assessment of the person.");
    expect(out).toContain("DISC C");
    expect(out).toContain("· low confidence");
    expect(out).toContain("How the % is computed");
    expect(out).toContain("Share of the role profile with public evidence, not a performance prediction.");
    expect(out).toContain('href="#ask"');
    expect(out).toContain("1 line dropped by the quote check");
    expect(out).toContain("2 lines dropped by the quote check");
  });

  it("evidence lines carry kind, direction, [n] deep link, retrieved day and the weakens count; sources list the retrieved date", () => {
    const out = html(profile);
    expect(out).toContain("Evidence (2)");
    expect(out).toMatch(/text-conflict">1 weakens</);
    expect(out).toContain(">supports<");
    expect(out).toContain(">weakens<");
    expect(out).toContain("border-conflict");
    expect(out).toContain(">9 Oct 2026<");
    expect(out).toContain("source missing");
    expect(out).toContain('href="https://example.com/about#:~:text=led%20the%20data%20team%20at%20Acme"');
    expect(out).toContain(">[1] example.com<");
    expect(out).toContain("Retrieved 9 Oct 2026, 10:00 UTC");
  });

  it("marks each line Independent or Self-reported and counts independent lines per item", () => {
    const out = html(Profile.parse({ ...profile, achievements: [{ text: "Grew Acme", evidence: [ev(), ev({ strength: "strong" })] }], risks: [{ text: "Short tenure", evidence: [ev()] }] }));
    expect(out).toContain(">Independent<");
    expect(out).toContain(">Self-reported<");
    const inferenceOnly = Profile.parse({ ...profile, achievements: [{ text: "Leads by example", evidence: [ev({ kind: "INFERENCE" })] }], risks: [], history: [], position_fit: [], personality: { ...profile.personality, evidence: [] } });
    expect(html(inferenceOnly)).not.toContain(">Self-reported<");
    expect(out).toContain(">1 independent<");
    expect(out).toMatch(/text-unsure">all self-reported</);
  });

  it("renders direction, note, detail, location, weights and style traits: context direction, note, detail, location, weights", () => {
    const withExtras: Profile = {
      ...profile,
      achievements: [{ text: "Grew revenue", detail: "Company-level result.", evidence: [ev({ direction: "context", note: "LinkedIn, self-reported" })] }],
      history: [{ ...acme, location: "Prague", duration: "1 yr 9 mos" }],
      position_fit: [{ ...cto, traits: [{ trait: "Leads teams", status: "has", weight: 3, evidence: [ev()] }, { trait: "Budget", status: "none", weight: 1, evidence: [] }] }],
      personality: { ...profile.personality, traits: [{ text: "Builder bias", detail: "", evidence: [ev()] }] },
    };
    const out = html(withExtras);
    expect(out).toContain(">context<");
    expect(out).toContain(">\u00a0· LinkedIn, self-reported<");
    expect(out).toContain("Company-level result.");
    expect(out).toContain("2019 – Present");
    expect(out).toContain(">1 yr 9 mos<");
    expect(out).toContain(">Prague<");
    expect(out).toMatch(/Acme<span class="font-normal text-ink">.*Data lead<\/span>/);
    expect(out).toMatch(/>75%</);
    expect(out).toContain("Builder bias");
  });

  it("computes fit from the traits, run's role first, every role in the capability table", () => {
    const cmo = { ...cto, role: "CMO", fit_pct: 10, traits: [{ trait: "Brand", status: "partial" as const, weight: 2, evidence: [] }] };
    const out = renderToStaticMarkup(
      createElement(ProfileSections, { profile: { ...profile, position_fit: [cto, cmo], personality: { ...profile.personality, disc: null } }, evidence, role: "CMO" }),
    );
    expect(out).toContain("Fit, CMO");
    expect(out.indexOf(">CMO<")).toBeLessThan(out.indexOf(">CTO<"));
    expect(out).toMatch(/>50%</);
    expect(out).toContain(">Brand");
    expect(out).toContain(">Leads teams");
    expect(out).toContain("Not enough of their own writing to suggest a type");
  });

  it("caps visible items and puts the rest behind Show N more; non-jobs collapsed", () => {
    const jobs = Array.from({ length: 7 }, (_, i) => ({ ...acme, organization: `Org${String(i)}` }));
    const out = html({ ...profile, achievements: many(5, "Win"), questions: many(7, "Q").map((q) => ({ text: q.text, closes: "" })), history: [...profile.history, ...jobs] });
    expect(html({ ...profile, questions: [{ text: "Why?", closes: "Closes the gap" }] })).toContain(">the gap<");
    expect(out).toContain("Show 2 more");
    expect(out).toContain("Show 3 earlier jobs");
    expect(out).toContain("Education, projects and community (1)");
    expect(out.indexOf("Win 3")).toBeLessThan(out.indexOf("Show 2 more"));
    expect(out.indexOf("Show 2 more")).toBeLessThan(out.indexOf("Win 4"));
    expect(out).toContain('start="6"');
    expect(out.indexOf("Acme")).toBeLessThan(out.indexOf("CTU"));
  });

  it("omits empty sections and their anchors", () => {
    const out = html({ ...profile, achievements: [], history: [], questions: [] });
    expect(out).not.toContain("Achievements");
    expect(out).not.toContain("3. History");
    expect(out).not.toContain('href="#ask"');
    expect(out).toContain("2. Risks");
  });

  it("renders only the degraded line when the profile was not built", () => {
    const out = html({ ...profile, degraded: "model timeout" });
    expect(out).toContain("Profile not built: ");
    expect(out).toContain("model timeout");
    expect(out).not.toContain("Achievements");
  });

  it("names evidence summaries for screen readers, keeps \"·\" off line starts, stacks the fit table on phones with evidence in its own full-width row", () => {
    const out = html(profile);
    expect(out).toMatch(/Evidence \(\d+\)<span class="sr-only"> for [^<]+<\/span>\u00a0·<\/span>/);
    expect(out).not.toMatch(/> ?· /);
    expect(out).toContain("max-sm:sr-only");
    expect(out).toMatch(/<tr class="max-sm:block"><td colSpan="\d+"[^>]*>/);
    expect(out).toContain('<span class="sm:hidden">weight </span>');
    expect(out).toContain("max-w-prose font-serif");
  });
});
