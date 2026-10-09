/**
 * Posting fetch plan tests: URL -> method, request URL, board and external id.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/posting-plan.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 */
import { describe, expect, it } from "vitest";
import { postingFetchPlan } from "@/recipe/seams/posting-plan";

const GH_API = "https://boards-api.greenhouse.io/v1/boards/acme/jobs/12345";
const UUID = "6ed76ce8-4156-4b60-b120-403538bd66cd";

describe("postingFetchPlan", () => {
  it("P1: null, empty and unparsable strings give pasted with no request", () => {
    for (const input of [null, "", "not a url"]) {
      const p = postingFetchPlan(input);
      expect(p.method).toBe("pasted");
      expect(p.request).toBeUndefined();
      expect(p.board).toBeUndefined();
      expect(p.externalId).toBeUndefined();
    }
  });

  it("P2: a Jobs.cz /rpd/ URL gives jobs-cz, board jobs.cz and the id, without fragment", () => {
    const p = postingFetchPlan("https://www.jobs.cz/rpd/2000123456/?searchId=x#top");
    expect(p).toEqual({
      method: "jobs-cz",
      request: { url: "https://www.jobs.cz/rpd/2000123456/?searchId=x" },
      board: "jobs.cz",
      externalId: "2000123456",
    });
    expect(postingFetchPlan("https://jobs.cz/rpd/2000123456/").method).toBe("jobs-cz");
  });

  it("P2b: Jobs.cz /fp/, /share/, career-site ?id= and beta /nabidka/<uuid> URLs give jobs-cz with the ad id; a career site without id is a plain page", () => {
    expect(postingFetchPlan("https://www.jobs.cz/fp/profinit-eu-s-r-o-214226/2001370717/?searchId=")).toMatchObject({ method: "jobs-cz", board: "jobs.cz", externalId: "2001370717" });
    expect(postingFetchPlan("https://asseco.jobs.cz/share/2001292088")).toMatchObject({ method: "jobs-cz", externalId: "2001292088" });
    expect(postingFetchPlan("https://jablotron.jobs.cz/detail-pozice?r=detail&id=2001283886&rps=0")).toMatchObject({
      method: "jobs-cz",
      request: { url: "https://jablotron.jobs.cz/detail-pozice?r=detail&id=2001283886&rps=0" },
      board: "jobs.cz",
      externalId: "2001283886",
    });
    expect(postingFetchPlan("https://beta.jobs.cz/nabidka/AD26C394-8f1f-4777-83de-3ffe8ed16493/")).toMatchObject({ method: "jobs-cz", externalId: "ad26c394-8f1f-4777-83de-3ffe8ed16493" });
    expect(postingFetchPlan("https://jablotron.jobs.cz/")).toEqual({ method: "jsonld", request: { url: "https://jablotron.jobs.cz/" } });
    expect(postingFetchPlan("https://www.jobs.cz/prace/?q=dev")).toEqual({ method: "jsonld", request: { url: "https://www.jobs.cz/prace/?q=dev" } });
  });

  it("P2c: a StartupJobs offer URL gives startupjobs with board startupjobs.cz and the numeric id", () => {
    expect(postingFetchPlan("https://www.startupjobs.cz/nabidka/49819/embedded-c-developer?utm=x#a")).toEqual({
      method: "startupjobs",
      request: { url: "https://www.startupjobs.cz/nabidka/49819/embedded-c-developer?utm=x" },
      board: "startupjobs.cz",
      externalId: "49819",
    });
    expect(postingFetchPlan("https://www.startupjobs.cz/nabidky").method).toBe("jsonld");
  });

  it("P3: Greenhouse path URLs on both hosts give the boards-api URL", () => {
    for (const host of ["boards.greenhouse.io", "job-boards.greenhouse.io"]) {
      expect(postingFetchPlan(`https://${host}/acme/jobs/12345`)).toEqual({
        method: "greenhouse",
        request: { url: GH_API },
        board: "greenhouse:acme",
        externalId: "12345",
      });
    }
  });

  it("P4: gh_jid on a Greenhouse board gives the API URL, on another host gives jsonld", () => {
    expect(postingFetchPlan("https://boards.greenhouse.io/acme?gh_jid=12345")).toEqual({
      method: "greenhouse",
      request: { url: GH_API },
      board: "greenhouse:acme",
      externalId: "12345",
    });
    const other = postingFetchPlan("https://careers.example.com/jobs?gh_jid=12345");
    expect(other).toEqual({ method: "jsonld", request: { url: "https://careers.example.com/jobs?gh_jid=12345" } });
  });

  it("P5: a Lever URL gives the postings API URL", () => {
    expect(postingFetchPlan(`https://jobs.lever.co/acme/${UUID}`)).toEqual({
      method: "lever",
      request: { url: `https://api.lever.co/v0/postings/acme/${UUID}` },
      board: "lever:acme",
      externalId: UUID,
    });
  });

  it("P6: an Ashby URL gives the job-board API URL and the posting uuid", () => {
    expect(postingFetchPlan(`https://jobs.ashbyhq.com/acme/${UUID}`)).toEqual({
      method: "ashby",
      request: { url: "https://api.ashbyhq.com/posting-api/job-board/acme" },
      board: "ashby:acme",
      externalId: UUID,
    });
  });

  it("P7: other http(s) URLs give jsonld, other schemes give pasted", () => {
    expect(postingFetchPlan("https://example.com/careers/dev")).toEqual({
      method: "jsonld",
      request: { url: "https://example.com/careers/dev" },
    });
    expect(postingFetchPlan("javascript:alert(1)").method).toBe("pasted");
    expect(postingFetchPlan("file:///etc/passwd").method).toBe("pasted");
  });
});
