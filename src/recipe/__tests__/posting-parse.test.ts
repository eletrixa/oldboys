/**
 * Posting parser tests: per-method payload to title, company, location and text, plus boilerplate stripping.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/posting-parse.test.ts
 * Deps:    vitest, node:fs
 * Tested:  n/a (this is the test)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePosting } from "@/recipe/seams/posting-parse";
import { stripBoilerplate } from "@/recipe/seams/posting-strip";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/postings/${name}`, import.meta.url), "utf8");
const json = (name: string): unknown => JSON.parse(fixture(name));

describe("parsePosting", () => {
  it("R1: Jobs.cz HTML gives title, company, locality and description text without tags", () => {
    const r = parsePosting("jobs-cz", fixture("jobs-cz-2001471225.html"));
    expect(r.title).toBe("Solution Architect pro AI & RAG platformu pro bankovní projekt");
    expect(r.company).toBe("Profinit EU, s.r.o.");
    expect(r.location).toBe("Praha");
    expect(r.text).toContain("Hledáme zkušeného Solution Architekta & mentora.");
    expect(r.text).toContain("5+ let zkušeností s návrhem řešení");
    expect(r.text).not.toMatch(/<[a-z]|&amp;|&nbsp;/);
    expect(r.text).toContain("Požadujeme:\n");
  });

  it("R2: JobPosting inside @graph or an array is found, a page without one gives empty text", () => {
    const posting = { "@type": "JobPosting", title: "Dev", description: "<p>Build things</p>", hiringOrganization: { name: "Acme" }, jobLocation: [{ address: { addressLocality: "Brno" } }] };
    const wrap = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
    const graph = parsePosting("jsonld", wrap({ "@context": "https://schema.org", "@graph": [{ "@type": "WebSite" }, posting] }));
    expect(graph).toEqual({ title: "Dev", company: "Acme", location: "Brno", text: "Build things" });
    expect(parsePosting("jsonld", wrap([{ "@type": "Thing" }, posting])).title).toBe("Dev");
    expect(parsePosting("jsonld", "<html><body>no data</body></html>")).toEqual({ text: "" });
    expect(parsePosting("jsonld", '<script type="application/ld+json">{broken</script>')).toEqual({ text: "" });
  });

  it("R3: Greenhouse JSON gives title, location, company and unescaped text", () => {
    const r = parsePosting("greenhouse", fixture("greenhouse-stripe-8172508.json"));
    expect(r.title).toBe("Abuse Investigator");
    expect(r.company).toBe("Stripe");
    expect(r.location).toBe("Dublin");
    expect(r.text.length).toBeGreaterThan(200);
    expect(r.text).not.toMatch(/&lt;|&gt;|<[a-z]/);
  });

  it("R4: Lever JSON includes list headings and items in the text", () => {
    const data = json("lever-palantir.json") as { lists: { text: string; content: string }[] };
    const r = parsePosting("lever", JSON.stringify(data));
    expect(r.title).toBeTruthy();
    expect(r.location).toBeTruthy();
    const list = data.lists[0];
    expect(r.text).toContain(list?.text);
    const firstItem = list?.content.match(/<li[^>]*>(.*?)<\/li>/s)?.[1]?.replace(/<[^>]+>/g, "").slice(0, 30);
    expect(firstItem).toBeTruthy();
    expect(r.text).toContain(firstItem);
    expect(r.text).not.toMatch(/<li|<\/li>/);
  });

  it("R5: Ashby picks the job matching externalId, an unknown id gives empty text", () => {
    const data = json("ashby-ashby.json") as { jobs: { id: string; title: string }[] };
    const second = data.jobs[1];
    const r = parsePosting("ashby", JSON.stringify(data), second?.id);
    expect(r.title).toBe(second?.title);
    expect(r.text.length).toBeGreaterThan(50);
    expect(parsePosting("ashby", JSON.stringify(data), "nope")).toEqual({ text: "" });
    expect(parsePosting("ashby", JSON.stringify(data))).toEqual({ text: "" });
  });

  it("R6: pasted trims the string, and bad payloads never throw", () => {
    expect(parsePosting("pasted", "  hello \n")).toEqual({ text: "hello" });
    expect(parsePosting("pasted", 42)).toEqual({ text: "" });
    for (const method of ["jobs-cz", "jsonld", "greenhouse", "lever", "ashby"] as const) {
      for (const bad of [null, undefined, 42, {}, "{not json", ""]) {
        expect(parsePosting(method, bad, "x").text).toBe("");
      }
    }
  });
});

describe("stripBoilerplate", () => {
  const body = [
    "# Senior Engineer",
    "",
    "About us",
    "",
    "We are a great company with a long history.",
    "",
    "Responsibilities",
    "",
    "Build the pipeline.",
    "",
    "Co nabízíme:",
    "- Home office",
    "- Sick days",
    "",
    "Requirements",
    "",
    "Five years of Python.",
  ].join("\n");

  it("R7: removes About us and Co nabízíme sections, keeps Requirements and Responsibilities", () => {
    const out = stripBoilerplate(body);
    expect(out).not.toMatch(/About us|great company|Co nabízíme|Home office/);
    expect(out).toContain("Responsibilities\n\nBuild the pipeline.");
    expect(out).toContain("Requirements\n\nFive years of Python.");
    expect(out).toContain("# Senior Engineer");
  });

  it("R8: removes Benefits: only through the next heading, and is idempotent", () => {
    const text = "Requirements:\nPython\n\nBenefits:\nFree lunch\nGym\n\nHow to apply:\nSend a CV.";
    const out = stripBoilerplate(text);
    expect(out).toBe("Requirements:\nPython\n\nHow to apply:\nSend a CV.");
    expect(stripBoilerplate(out)).toBe(out);
    expect(stripBoilerplate(stripBoilerplate(body))).toBe(stripBoilerplate(body));
  });

  it("R9: text without the headings is returned unchanged", () => {
    const text = "# Role\n\nRequirements:\nPython.\n\nResponsibilities\n\nShip it.";
    expect(stripBoilerplate(text)).toBe(text);
  });
});
