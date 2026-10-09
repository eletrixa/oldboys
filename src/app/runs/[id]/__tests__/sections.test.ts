/**
 * Tests for which brief sections the report page renders, and the claim evidence disclosure (idea #5).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/sections.test.ts
 * Deps:    vitest, react, react-dom/server (static markup, no DOM)
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - Sections with no claims and no sources never render; a claimless social presence that lists profiles renders
 * - ClaimList: quote deep link with the retrieval date in the tooltip, quote + saved copy with the match marked,
 *   STATEMENT label, inference note, CV source as text
 * - Czech report (idea #24): labels and claim text in Czech, the quote and saved copy unchanged and marked lang=""
 *
 * Design constraints:
 * - Fixtures stay inline
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BriefSection, Claim } from "@/domain/claim";
import { evidenceOf } from "../evidence";
import { makeReport } from "../i18n";
import { ReportContext } from "../report-lang";
import { ClaimList } from "../sections";
import { isShown } from "../state";

const sec = (over: Partial<BriefSection>): BriefSection => ({
  id: "x", title: "X", confidence: 0.5, confidence_reason: "r", claim_ids: [], source_ids: [], summary: "", ...over,
});

describe("isShown", () => {
  it("shows a section with claims", () => {
    expect(isShown(sec({ claim_ids: ["c1"] }))).toBe(true);
  });

  it("hides sections with neither claims nor sources", () => {
    expect(isShown(sec({}))).toBe(false);
    expect(isShown(sec({ id: "contradictions" }))).toBe(false);
    expect(isShown(sec({ id: "social-presence" }))).toBe(false);
  });

  it("shows a claimless social presence that lists confirmed profiles", () => {
    expect(isShown(sec({ id: "social-presence", source_ids: ["s1"] }))).toBe(true);
  });

  it("keeps a source-only platform section", () => {
    expect(isShown(sec({ id: "evidence-github", source_ids: ["s1"] }))).toBe(true);
  });
});

const claim = (over: Partial<Claim>): Claim => ({
  id: "c1", run_id: "r1", question_id: "q1", candidate_id: null, text: "Works as a data engineer", kind: "FACT", confidence: 0.9,
  quote: "data engineer at Acme", supports: ["s1"], contradicts: [], rank: 0, ...over,
});

const evidence = evidenceOf({
  sources: [
    { id: "s1", url: "https://example.com/about", identity_reason: "name and employer match (Acme)", fetched_at: "2026-10-09T23:14:00Z", expires_at: "2026-10-16T23:14:00Z" },
    { id: "cv", url: "cv:r1", fetched_at: "2026-10-09T22:00:00Z", expires_at: "2026-10-16T22:00:00Z" },
  ],
  quote_contexts: [{ claim_id: "c1", source_id: "s1", before: "Jane is a ", match: "data engineer at Acme", after: " since 2019." }],
});

const render = (claims: Claim[]): string => renderToStaticMarkup(createElement(ClaimList, { claims, evidence }));

describe("ClaimList evidence", () => {
  it("links to the source at the quote, with the retrieval date and identity reason in the tooltip", () => {
    const html = render([claim({})]);
    expect(html).toContain('href="https://example.com/about#:~:text=data%20engineer%20at%20Acme"');
    expect(html).toContain('title="Confirmed: name and employer match (Acme) · Retrieved 9 Oct 2026, 23:14 UTC"');
    expect(html).toContain(">example.com</a>");
  });

  it("shows the quote, the saved copy with the match marked and until when it is kept", () => {
    const html = render([claim({})]);
    expect(html).toContain("Show evidence");
    expect(html).toContain("Quote from the source");
    expect(html).toContain("“data engineer at Acme”");
    expect(html).toContain("Open at the quote");
    expect(html).toContain("Saved copy when retrieved (kept until 16 Oct 2026)");
    expect(html).toContain("Jane is a <mark");
    expect(html).toContain(">data engineer at Acme</mark> since 2019.");
    expect(html).toContain("Confirmed: name and employer match (Acme)");
  });

  it("labels a STATEMENT as said by the candidate, and an inference as having no direct quote", () => {
    expect(render([claim({ kind: "STATEMENT" })])).toContain("Said by the candidate, not public evidence");
    const inference = render([claim({ kind: "INFERENCE", quote: null })]);
    expect(inference).toContain("Inference: no direct quote, drawn from these sources");
    expect(inference).toContain("Open the source");
    expect(inference).toContain("Retrieved 9 Oct 2026, 23:14 UTC");
    expect(inference).not.toContain("Saved copy");
  });

  it("keeps the pasted CV as text without a link", () => {
    const html = render([claim({ id: "c2", supports: ["cv"] })]);
    expect(html).toContain("Candidate&#x27;s CV (pasted)");
    expect(html).not.toContain('href="cv:');
  });
});

describe("ClaimList in Czech", () => {
  const report = makeReport("cs", { "c:c1": "Pracuje jako datový inženýr.", "src:s1": "shoda jména a zaměstnavatele (Acme)" });
  const renderCs = (claims: Claim[]): string =>
    renderToStaticMarkup(createElement(ReportContext, { value: report }, createElement(ClaimList, { claims, evidence })));

  it("shows Czech labels and the translated claim, the quote stays in the original", () => {
    const html = renderCs([claim({}), claim({ id: "c3", text: "Leads a team" })]);
    expect(html).toContain("Fakt");
    expect(html).toContain("Pracuje jako datový inženýr.");
    expect(html).toContain("Leads a team");
    expect(html).toContain("Zobrazit doklady");
    expect(html).toContain("Citace v originále");
    expect(html).toContain('<blockquote lang=""');
    expect(html).toContain("“data engineer at Acme”");
    expect(html).toContain("Otevřít u citace");
    expect(html).toContain("Uložená kopie z doby načtení (uchováváme do 16. 10. 2026)");
    expect(html).toContain("Potvrzeno: shoda jména a zaměstnavatele (Acme) · Načteno 9. 10. 2026, 23:14 UTC");
    expect(html).not.toContain("Show evidence");
  });
});
