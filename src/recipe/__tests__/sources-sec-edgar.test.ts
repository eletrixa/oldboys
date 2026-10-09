/**
 * Tests for the SEC EDGAR full-text search collector.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/sources-sec-edgar.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test)
 *
 * Key responsibilities:
 * - request url and headers, skip for a one-word name, overview and filing sources, ordering, dedupe, digest
 *
 * Design constraints:
 * - No network; the fixture is a shortened real response
 */
import { describe, expect, it } from "vitest";
import type { Step } from "@/recipe/step";
import { secEdgar } from "@/recipe/sources/sec-edgar";
import { baseContext } from "@/recipe/__tests__/fakes";

const step = {} as Step;
const ctx = baseContext({ subject: "Dušan Šenkypl" });

const payload = {
  hits: {
    total: { value: 509, relation: "eq" },
    hits: [
      {
        _id: "0000947871-21-001145:ss596167_ex9902.htm",
        _source: {
          ciks: ["0001490281", "0001892479"],
          display_names: ["Groupon, Inc.  (GRPN)  (CIK 0001490281)", "Barta Jan  (CIK 0001892479)"],
          root_forms: ["SC 13D"],
          form_type: "SC 13D/A",
          file_date: "2021-11-05",
          file_description: null,
        },
      },
      {
        _id: "0000921895-26-002350:ex991to13d13335012_082726.htm",
        _source: {
          ciks: ["0001626450", "0001922318"],
          display_names: ["Commerce.com, Inc.  (CMRC)  (CIK 0001626450)", "Pale Fire Capital SE  (CIK 0001922318)"],
          root_forms: ["SCHEDULE 13D"],
          form_type: "SCHEDULE 13D",
          file_date: "2026-08-27",
          file_description: "JOINT FILING AGREEMENT",
        },
      },
      {
        _id: "0000921895-26-002350:other.htm",
        _source: { ciks: ["0001626450"], form_type: "SCHEDULE 13D", file_date: "2026-08-27" },
      },
    ],
  },
  aggregations: { form_filter: { buckets: [{ key: "N-PX", doc_count: 260 }, { key: "8-K", doc_count: 56 }] } },
};

describe("secEdgar", () => {
  it("requests the quoted ASCII name with a user agent", () => {
    const [req] = secEdgar.requests(ctx, step);
    expect(req).toMatchObject({
      via: "fetch",
      url: "https://efts.sec.gov/LATEST/search-index?q=%22Dusan%20Senkypl%22",
      init: { headers: { "user-agent": "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)", accept: "application/json" } },
    });
  });

  it("skips a one-word name", () => {
    const one = baseContext({ subject: "Madonna" });
    expect(secEdgar.requests(one, step)).toEqual([]);
    expect(secEdgar.skipReason?.(one)).toBe("name has no surname to search");
  });

  it("writes an overview source a FACT can quote", () => {
    const [o] = secEdgar.parse(payload, ctx, step);
    expect(o?.url).toBe("https://www.sec.gov/edgar/search/#/q=%22Dusan%20Senkypl%22");
    expect(o?.excerpt).toBe(
      "SEC EDGAR full-text search lists 509 filings that name Dusan Senkypl. By form: 260 N-PX, 56 8-K.",
    );
  });

  it("builds archive urls, orders newest first and dedupes by accession", () => {
    const out = secEdgar.parse(payload, ctx, step).slice(1);
    expect(out.map((p) => p.url)).toEqual([
      "https://www.sec.gov/Archives/edgar/data/1626450/000092189526002350/ex991to13d13335012_082726.htm",
      "https://www.sec.gov/Archives/edgar/data/1490281/000094787121001145/ss596167_ex9902.htm",
    ]);
    expect(out[0]?.excerpt).toBe(
      "Named in SEC filing SCHEDULE 13D filed 2026-08-27 by Commerce.com, Inc.  (CMRC)  (CIK 0001626450) and Pale Fire Capital SE  (CIK 0001922318). Document: JOINT FILING AGREEMENT. The filing text names Dusan Senkypl.",
    );
    expect(out[1]?.excerpt).not.toContain("Document:");
  });

  it("names the subject in every excerpt and leaves identity unverified", () => {
    const out = secEdgar.parse(payload, ctx, step);
    for (const p of out) {
      expect(p.excerpt).toContain("Dusan Senkypl");
      expect(p.identity).toBe("unverified");
    }
  });

  it("parses null to nothing", () => {
    expect(secEdgar.parse(null, ctx, step)).toEqual([]);
  });

  it("digests total, forms and filing count", () => {
    const req = secEdgar.requests(ctx, step)[0];
    if (!req) throw new Error("no request");
    expect(secEdgar.digest?.([{ req, payload }], ctx)).toEqual({
      total: 509,
      byForm: [
        { form: "N-PX", count: 260 },
        { form: "8-K", count: 56 },
      ],
      filings: 2,
    });
  });
});
