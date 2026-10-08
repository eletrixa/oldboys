/**
 * Tests for the maker REST collectors: request URLs and payload parsing.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-makers.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { github } from "@/recipe/sources/github";
import { huggingface } from "@/recipe/sources/huggingface";
import { openalex } from "@/recipe/sources/openalex";
import { orcid } from "@/recipe/sources/orcid";
import { stackexchange } from "@/recipe/sources/stackexchange";
import type { CollectorRequest } from "@/recipe/sources/types";
import type { Step } from "@/recipe/step";
import type { Candidate } from "@/domain/claim";
import { baseContext } from "@/recipe/__tests__/fakes";

const step: Step = { id: "s", kind: "actor", actor: "x" };

function cand(platform: string, handle: string): Candidate {
  return {
    id: "c1",
    run_id: "run-1",
    name: "Jana Dvořáková",
    profile_urls: [],
    anchor_match: null,
    score: 0.9,
    decision: "merge",
    platform,
    handle,
    snippet: "",
    reasons: [],
  };
}

function urls(reqs: readonly CollectorRequest[]): string[] {
  return reqs.map((r) => (r.via === "fetch" ? r.url : "actor"));
}

describe("github", () => {
  it("requests user and repos for an accepted github candidate", () => {
    const ctx = baseContext({ candidates: [cand("github", "jdvorakova")] });
    expect(urls(github.requests(ctx, step))).toEqual([
      "https://api.github.com/users/jdvorakova",
      "https://api.github.com/users/jdvorakova/repos?sort=updated&per_page=10",
    ]);
  });
  it("searches by name without a candidate", () => {
    expect(urls(github.requests(baseContext(), step))).toEqual([
      "https://api.github.com/search/users?q=Jana%20Dvo%C5%99%C3%A1kov%C3%A1+in:name",
    ]);
  });
  it("parses user, repos and search payloads", () => {
    const ctx = baseContext();
    const user = github.parse({ login: "jd", html_url: "https://github.com/jd", name: "Jana", company: "Kiwi", public_repos: 7 }, ctx, step);
    expect(user[0]?.url).toBe("https://github.com/jd");
    expect(user[0]?.excerpt).toContain("Kiwi");
    const repos = github.parse([{ html_url: "https://github.com/jd/etl", name: "etl", language: "Python", stargazers_count: 5 }], ctx, step);
    expect(repos[0]?.excerpt).toContain("Python");
    const found = github.parse({ items: [{ html_url: "https://github.com/jd", login: "jd" }] }, ctx, step);
    expect(found[0]?.excerpt).toContain("jd");
    expect(github.parse("nope", ctx, step)).toEqual([]);
  });
});

describe("stackexchange", () => {
  it("builds the user search URL", () => {
    expect(urls(stackexchange.requests(baseContext(), step))[0]).toContain("inname=Jana%20Dvo%C5%99%C3%A1kov%C3%A1&site=stackoverflow");
  });
  it("parses users", () => {
    const out = stackexchange.parse({ items: [{ link: "https://stackoverflow.com/users/1/jd", display_name: "jd", reputation: 1234, location: "Brno", creation_date: 1500000000 }] }, baseContext(), step);
    expect(out[0]?.url).toBe("https://stackoverflow.com/users/1/jd");
    expect(out[0]?.excerpt).toContain("reputation 1234");
  });
});

describe("huggingface", () => {
  it("uses the accepted huggingface handle", () => {
    const ctx = baseContext({ candidates: [cand("huggingface", "jana-d")] });
    expect(urls(huggingface.requests(ctx, step))).toEqual(["https://huggingface.co/api/models?author=jana-d&limit=10"]);
  });
  it("falls back to the subject slug", () => {
    expect(urls(huggingface.requests(baseContext({ subject: "Jana Novak" }), step))).toEqual([
      "https://huggingface.co/api/models?author=jana-novak&limit=10",
    ]);
  });
  it("parses models", () => {
    const out = huggingface.parse([{ id: "jana-d/bert", downloads: 10, likes: 2, lastModified: "2026-01-01" }], baseContext(), step);
    expect(out[0]?.url).toBe("https://huggingface.co/jana-d/bert");
    expect(out[0]?.excerpt).toContain("10 downloads");
  });
});

describe("orcid", () => {
  it("builds a given/family query with a JSON accept header", () => {
    const [req] = orcid.requests(baseContext({ subject: "Jana Novak" }), step);
    expect(req?.via === "fetch" && req.url).toBe(
      "https://pub.orcid.org/v3.0/expanded-search/?q=given-names%3AJana%20AND%20family-name%3ANovak&rows=5",
    );
    expect(req?.via === "fetch" && req.init?.headers?.accept).toBe("application/json");
  });
  it("returns no request for a single-token subject", () => {
    expect(orcid.requests(baseContext({ subject: "Navěky" }), step)).toEqual([]);
  });
  it("parses hits", () => {
    const out = orcid.parse({ "expanded-result": [{ "orcid-id": "0000-0001-2345-6789", "given-names": "Jana", "family-names": "Novak", "institution-name": ["MUNI"] }] }, baseContext(), step);
    expect(out[0]?.url).toBe("https://orcid.org/0000-0001-2345-6789");
    expect(out[0]?.excerpt).toContain("MUNI");
  });
});

describe("openalex", () => {
  it("builds the author search URL", () => {
    expect(urls(openalex.requests(baseContext({ subject: "Jana Novak" }), step))).toEqual([
      "https://api.openalex.org/authors?search=Jana%20Novak&per-page=5",
    ]);
  });
  it("parses authors", () => {
    const out = openalex.parse({ results: [{ id: "https://openalex.org/A1", display_name: "Jana Novak", works_count: 12, cited_by_count: 99, last_known_institutions: [{ display_name: "MUNI" }] }] }, baseContext(), step);
    expect(out[0]?.url).toBe("https://openalex.org/A1");
    expect(out[0]?.excerpt).toContain("MUNI");
  });
});
