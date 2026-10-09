/**
 * Posting fetch plan: maps a posting URL to the free endpoint that serves it, plus the dedupe key.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/posting-plan.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/posting-plan.test.ts
 *
 * Key responsibilities:
 * - `postingFetchPlan`: method, request URL, board and external id for Jobs.cz (www, beta, `<company>.jobs.cz` career sites), StartupJobs, Greenhouse, Lever, Ashby, any other http(s) page
 *
 * Design constraints:
 * - Pure and never throws; an unparsable or non-http(s) string is treated as no URL (`pasted`)
 * - Only the hosts in the plan table are rewritten; every other host is fetched as the user's own URL (`jsonld`)
 */
import type { IngestMethod } from "@/domain/position";

export type PostingMethod = IngestMethod;

export type PostingPlan = {
  method: PostingMethod;
  request?: { url: string };
  board?: string;
  externalId?: string;
};

const PASTED: PostingPlan = { method: "pasted" };
const GREENHOUSE_HOSTS = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);

function parseHttpUrl(input: string | null): URL | null {
  if (input === null || input.trim() === "") return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function greenhouse(board: string, id: string): PostingPlan {
  return {
    method: "greenhouse",
    request: { url: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}` },
    board: `greenhouse:${board}`,
    externalId: id,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ad id of a Jobs.cz URL: `/rpd/<id>`, `/fp/<company>/<id>`, `/share/<id>`, `?id=<id>` on a career site, or the uuid of `beta.jobs.cz/nabidka/<uuid>`. */
function jobsCzId(host: string, segs: (string | undefined)[], idParam: string | null): string | undefined {
  const [first, second, third] = segs;
  const digits = (v: string | null | undefined): string | undefined => (v !== null && v !== undefined && /^\d+$/.test(v) ? v : undefined);
  if (first === "rpd" || first === "share") return digits(second);
  if (first === "fp") return digits(third);
  if (first === "nabidka" && second !== undefined && UUID.test(second)) return second.toLowerCase();
  return host === "jobs.cz" ? undefined : digits(idParam);
}

export function postingFetchPlan(input: string | null): PostingPlan {
  const url = parseHttpUrl(input);
  if (!url) return PASTED;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const [first, second, third] = url.pathname.split("/").filter((seg) => seg !== "");

  const clean = new URL(url);
  clean.hash = "";
  if (host === "jobs.cz" || host.endsWith(".jobs.cz")) {
    const id = jobsCzId(host, [first, second, third], url.searchParams.get("id"));
    if (id !== undefined) return { method: "jobs-cz", request: { url: clean.href }, board: "jobs.cz", externalId: id };
  }
  if (host === "startupjobs.cz" && first === "nabidka" && second !== undefined && /^\d+$/.test(second)) {
    return { method: "startupjobs", request: { url: clean.href }, board: "startupjobs.cz", externalId: second };
  }
  if (GREENHOUSE_HOSTS.has(host) && first !== undefined) {
    const id = second === "jobs" ? third : url.searchParams.get("gh_jid");
    if (id !== null && id !== undefined && /^\d+$/.test(id)) return greenhouse(first, id);
  }
  if (host === "jobs.lever.co" && first !== undefined && second !== undefined) {
    return { method: "lever", request: { url: `https://api.lever.co/v0/postings/${first}/${second}` }, board: `lever:${first}`, externalId: second };
  }
  if (host === "jobs.ashbyhq.com" && first !== undefined && second !== undefined) {
    return { method: "ashby", request: { url: `https://api.ashbyhq.com/posting-api/job-board/${first}` }, board: `ashby:${first}`, externalId: second };
  }
  return { method: "jsonld", request: { url: url.href } };
}
