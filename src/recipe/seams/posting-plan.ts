/**
 * Posting fetch plan: maps a posting URL to the free endpoint that serves it, plus the dedupe key.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/posting-plan.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/posting-plan.test.ts
 *
 * Key responsibilities:
 * - `postingFetchPlan`: method, request URL, board and external id for Jobs.cz, Greenhouse, Lever, Ashby, any other http(s) page
 *
 * Design constraints:
 * - Pure and never throws; an unparsable or non-http(s) string is treated as no URL (`pasted`)
 * - Only the hosts in the plan table are rewritten; every other host is fetched as the user's own URL (`jsonld`)
 */
export type PostingMethod = "pasted" | "jobs-cz" | "greenhouse" | "lever" | "ashby" | "jsonld";

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

export function postingFetchPlan(input: string | null): PostingPlan {
  const url = parseHttpUrl(input);
  if (!url) return PASTED;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const [first, second, third] = url.pathname.split("/").filter((seg) => seg !== "");

  if (host === "jobs.cz" && first === "rpd" && second !== undefined && /^\d+$/.test(second)) {
    const clean = new URL(url);
    clean.hash = "";
    return { method: "jobs-cz", request: { url: clean.href }, board: "jobs.cz", externalId: second };
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
