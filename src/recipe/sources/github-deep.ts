/**
 * GitHub deep collector: per-repo contribution statistics, merged PRs elsewhere, recent activity and orgs for technical roles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/github-deep.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/github-deep.test.ts
 *
 * Key responsibilities:
 * - `rest/github-deep`: for accepted github handles (max 2) of a technical role family, five first-wave requests per handle,
 *   then `followUp` asks stats/contributors for the 6 most recently pushed own, non-fork, non-archived repos per handle
 * - `kindOf`: classifies a request URL (user, repos, search, events, orgs, stats) and names its handle or repo
 * - `parse`: every payload becomes plain-sentence excerpts with numbers, so the extract seam can quote them as FACTs
 * - `repoStats`: the one aggregation of a stats payload (commits, lines, first and last week, share), used by excerpt and digest
 * - `digest`: one `CodeProfile` (src/domain/code-profile.ts) for the handle with more own repos
 *
 * Design constraints:
 * - Pure: no fetch here. Handle and repo always come from the request URL (`parse`'s 4th argument, `Fetched.req` in
 *   `followUp` and `digest`), never from payload contents; a request without a recognised URL yields nothing
 * - `stats_pending` = the stats requests selected for the digest's handle whose payload is missing or null (GitHub's 202)
 * - About 22 GitHub requests per step at most (5 per handle + 12 stats)
 */
import { z } from "zod";
import { CodeProfile, isTechnicalFamily } from "@/domain/code-profile";
import type { Collector, CollectorRequest, Fetched, ParsedSource, StepContext } from "@/recipe/sources/types";
import { clip, githubHandles, identityFor } from "@/recipe/sources/types";

const API = "https://api.github.com";
const MAX_STATS_REPOS = 6;
const PER_PAGE = 10;

const User = z.object({ login: z.string(), html_url: z.string().optional(), name: z.string().nullish(), bio: z.string().nullish(), company: z.string().nullish(), location: z.string().nullish(), public_repos: z.number().optional(), followers: z.number().optional(), created_at: z.string().nullish() });
const Repo = z.object({ name: z.string(), html_url: z.string(), owner: z.object({ login: z.string() }), fork: z.boolean().optional(), archived: z.boolean().optional(), pushed_at: z.string().nullish(), stargazers_count: z.number().optional(), language: z.string().nullish(), size: z.number().optional() });
type Repo = z.infer<typeof Repo>;
const StatsRow = z.object({ total: z.number(), author: z.object({ login: z.string() }).nullish(), weeks: z.array(z.object({ w: z.number(), a: z.number(), d: z.number(), c: z.number() })) });
type StatsRow = z.infer<typeof StatsRow>;
const Search = z.object({ total_count: z.number(), items: z.array(z.object({ title: z.string(), html_url: z.string(), repository_url: z.string(), author_association: z.string().nullish(), pull_request: z.object({ merged_at: z.string().nullish() }).nullish() })) });
const Event = z.object({ type: z.string(), created_at: z.string() });
const Org = z.object({ login: z.string() });

type SearchData = z.infer<typeof Search>;
/** `-user:{h}` keeps orgs the person owns or belongs to: drop OWNER/MEMBER items; the count is the kept items when the page holds every hit, else GitHub's total. */
function elsewhere(d: SearchData): { count: number; merged: SearchData["items"] } {
  const kept = d.items.filter((i) => i.author_association !== "OWNER" && i.author_association !== "MEMBER");
  return { count: d.total_count <= PER_PAGE ? kept.length : d.total_count, merged: kept.filter((i) => typeof i.pull_request?.merged_at === "string") };
}

const day = (iso: string): string => iso.slice(0, 10);
const plural = (n: number, one: string, many: string): string => `${String(n)} ${n === 1 ? one : many}`;
const nonEmptyArray = <T extends z.ZodType>(s: T) => z.array(s).min(1);
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const urlsFor = (h: string): { user: string; repos: string; search: string; events: string; orgs: string } => {
  const e = encodeURIComponent(h);
  const q = [`author:${h}`, "type:pr", "is:merged", `-user:${h}`].map(encodeURIComponent).join("+");
  return { user: `${API}/users/${e}`, repos: `${API}/users/${e}/repos?type=owner&sort=pushed&per_page=100`, search: `${API}/search/issues?q=${q}&per_page=10`, events: `${API}/users/${e}/events/public?per_page=100`, orgs: `${API}/users/${e}/orgs` };
};
const statsUrl = (fullName: string): string => `${API}/repos/${fullName}/stats/contributors`;

type Kind = { kind: "user" | "repos" | "search" | "events" | "orgs"; handle: string } | { kind: "stats"; repo: string };
/** What a request URL asks for: the five per-handle endpoints (handle decoded) or a repo's stats ("owner/name"); null for anything else. */
export function kindOf(url: string): Kind | null {
  try {
    const u = new URL(url);
    if (u.host !== "api.github.com") return null;
    const seg = u.pathname.split("/").filter((x) => x !== "").map(decodeURIComponent);
    if (seg[0] === "search" && seg[1] === "issues") {
      const handle = /author:(\S+)/.exec(u.searchParams.get("q") ?? "")?.[1];
      return handle === undefined ? null : { kind: "search", handle };
    }
    if (seg[0] === "users" && seg[1] !== undefined) {
      const tail = seg[2];
      if (tail === undefined) return { kind: "user", handle: seg[1] };
      return tail === "repos" || tail === "events" || tail === "orgs" ? { kind: tail, handle: seg[1] } : null;
    }
    if (seg[0] === "repos" && seg.length === 5 && seg[3] === "stats" && seg[4] === "contributors") return { kind: "stats", repo: `${seg[1] ?? ""}/${seg[2] ?? ""}` };
  } catch {
    /* not a URL, or a malformed escape */
  }
  return null;
}

const kindOfReq = (req: CollectorRequest | undefined): Kind | null => (req?.via === "fetch" ? kindOf(req.url) : null);

/** The payload fetched for one per-handle endpoint (undefined when it was not requested). */
function payloadOf(fetched: readonly Fetched[], kind: Exclude<Kind["kind"], "stats">, handle: string): unknown {
  return fetched.find((f) => { const k = kindOfReq(f.req); return k !== null && k.kind === kind && "handle" in k && same(k.handle, handle); })?.payload;
}

const reposOf = (fetched: readonly Fetched[], handle: string): Repo[] => {
  const r = nonEmptyArray(Repo).safeParse(payloadOf(fetched, "repos", handle));
  return r.success ? r.data : [];
};

const statsRowsOf = (fetched: readonly Fetched[], repo: string): StatsRow[] | null => {
  const f = fetched.find((x) => { const k = kindOfReq(x.req); return k?.kind === "stats" && same(k.repo, repo); });
  const r = nonEmptyArray(StatsRow).safeParse(f?.payload);
  return r.success ? r.data : null;
};

/** The repos worth a stats request: own, not fork, not archived, not empty, newest push first, at most six. */
function statsSelection(repos: readonly Repo[]): Repo[] {
  return repos
    .filter((r) => r.fork !== true && r.archived !== true && (r.size ?? 0) > 0)
    .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, MAX_STATS_REPOS);
}

const fullName = (r: Repo): string => `${r.owner.login}/${r.name}`;
const repoOfUrl = (url: string): string => url.split("/").slice(-2).join("/");

/** The handle's row in a stats payload as numbers (ISO first and last active week, share of all commits 0..1); null when GitHub lists no row for the handle. */
function repoStats(rows: readonly StatsRow[], handle: string): { commits: number; additions: number; deletions: number; first_week: string | null; last_week: string | null; share: number | null } | null {
  const row = rows.find((r) => r.author !== null && r.author !== undefined && same(r.author.login, handle));
  if (row === undefined) return null;
  const active = row.weeks.filter((w) => w.c > 0);
  const iso = (w: number | undefined): string | null => (w === undefined ? null : new Date(w * 1000).toISOString().slice(0, 10));
  const all = rows.reduce((s, r) => s + r.total, 0);
  return { commits: row.total, additions: row.weeks.reduce((s, w) => s + w.a, 0), deletions: row.weeks.reduce((s, w) => s + w.d, 0), first_week: iso(active[0]?.w), last_week: iso(active.at(-1)?.w), share: all > 0 ? row.total / all : null };
}

function statsLine(repo: string, handle: string, rows: readonly StatsRow[]): string {
  const s = repoStats(rows, handle);
  if (s === null) return `${repo}: ${handle} made 0 commits (not among the contributors GitHub attributes commits to)`;
  return `${repo}: ${handle} made ${String(s.commits)} commits, +${String(s.additions)} lines added, −${String(s.deletions)} lines removed, between ${s.first_week ?? "?"} and ${s.last_week ?? "?"} (share of all commits ${String(Math.round((s.share ?? 0) * 100))}%)`;
}

function languageCounts(repos: readonly Repo[]): [string, number][] {
  const m = new Map<string, number>();
  for (const r of repos) if (typeof r.language === "string" && r.language !== "") m.set(r.language, (m.get(r.language) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function parseOne(payload: unknown, ctx: StepContext, req: CollectorRequest | undefined): ParsedSource[] {
  const k = kindOfReq(req);
  if (k === null) return [];
  const handle = k.kind === "stats" ? (k.repo.split("/")[0] ?? "") : k.handle;
  const source = (url: string, excerpt: string): ParsedSource[] => [{ url, excerpt: clip(excerpt), raw: payload, identity: identityFor(ctx, `https://github.com/${handle}`) }];
  switch (k.kind) {
    case "search": {
      const d = Search.safeParse(payload);
      if (!d.success) return [];
      const { count, merged: all } = elsewhere(d.data);
      const eg = all.slice(0, 5).map((i) => `${repoOfUrl(i.repository_url)}: ${i.title} (merged ${day(i.pull_request?.merged_at ?? "")})`);
      return source(`https://github.com/pulls?q=${encodeURIComponent(`is:pr author:${handle} is:merged -user:${handle}`)}`, `${plural(count, "pull request", "pull requests")} by ${handle} merged into repositories of others${eg.length > 0 ? `, e.g. ${eg.join("; ")}` : ""}`);
    }
    case "user": {
      const u = User.safeParse(payload);
      if (!u.success) return [];
      const parts = [u.data.name ?? u.data.login, u.data.bio, u.data.company, u.data.location, u.data.public_repos === undefined ? null : `${String(u.data.public_repos)} public repos`, u.data.followers === undefined ? null : `${String(u.data.followers)} followers`, typeof u.data.created_at !== "string" ? null : `account created ${day(u.data.created_at)}`];
      return source(u.data.html_url ?? `https://github.com/${handle}`, parts.filter((x): x is string => typeof x === "string" && x.length > 0).join(" · "));
    }
    case "repos": {
      const repos = nonEmptyArray(Repo).safeParse(payload);
      if (!repos.success) return [];
      const own = repos.data.filter((r) => r.fork !== true);
      const langs = languageCounts(own).slice(0, 8).map(([n, c]) => `${n} (${plural(c, "repo", "repos")})`);
      const stars = own.reduce((s, r) => s + (r.stargazers_count ?? 0), 0);
      const cut = repos.data.length >= 100 ? " (the 100 most recently pushed only)" : "";
      return source(`https://github.com/${handle}?tab=repositories`, `${plural(repos.data.length, "public repository", "public repositories")} owned, ${plural(repos.data.length - own.length, "fork", "forks")} excluded, languages: ${langs.join(", ") || "none"}, ${String(stars)} stars received across own repos${cut}`);
    }
    case "stats": {
      const rows = nonEmptyArray(StatsRow).safeParse(payload); // null = still computing: no source, the digest names the repo as pending
      return rows.success ? source(`https://github.com/${k.repo}/graphs/contributors`, statsLine(k.repo, handle, rows.data)) : [];
    }
    case "events": {
      const events = nonEmptyArray(Event).safeParse(payload);
      if (!events.success) return [];
      const n = (t: string): number => events.data.filter((e) => e.type === t).length;
      const oldest = events.data.map((e) => e.created_at).sort()[0];
      return source(`https://github.com/${handle}?tab=overview`, `last 90 days of public activity: ${plural(n("PushEvent"), "push", "pushes")}, ${plural(n("PullRequestEvent"), "pull request", "pull requests")}, ${plural(n("IssuesEvent"), "issue", "issues")}, ${plural(n("PullRequestReviewEvent"), "review", "reviews")}${oldest === undefined ? "" : `, since ${day(oldest)}`}`);
    }
    case "orgs": {
      const orgs = nonEmptyArray(Org).safeParse(payload);
      return orgs.success ? source(urlsFor(handle).orgs, `member of organizations: ${orgs.data.map((o) => o.login).join(", ")}`) : [];
    }
  }
}

function buildDigest(fetched: readonly Fetched[], ctx: StepContext): unknown {
  const found = githubHandles(ctx).flatMap((h) => { const u = User.safeParse(payloadOf(fetched, "user", h)); return u.success ? [{ handle: h, user: u.data, mine: reposOf(fetched, h) }] : []; });
  const best = [...found].sort((a, b) => b.mine.length - a.mine.length)[0];
  if (best === undefined) return null;
  const { handle, user, mine } = best;
  const own = mine.filter((r) => r.fork !== true);
  const selected = statsSelection(mine);
  const rowsOf = new Map(selected.flatMap((r) => { const rows = statsRowsOf(fetched, fullName(r)); return rows === null ? [] : [[fullName(r), rows] as const]; }));
  const repos = selected.flatMap((r) => {
    const rows = rowsOf.get(fullName(r));
    if (rows === undefined) return [];
    const s = repoStats(rows, handle);
    return [{ full_name: fullName(r), url: r.html_url, commits: s?.commits ?? 0, additions: s?.additions ?? 0, deletions: s?.deletions ?? 0, first_week: s?.first_week ?? null, last_week: s?.last_week ?? null, language: r.language ?? null, stars: r.stargazers_count ?? 0, share: s?.share ?? 0, source_url: statsUrl(fullName(r)) }];
  });
  const search = Search.safeParse(payloadOf(fetched, "search", handle));
  const events = nonEmptyArray(Event).safeParse(payloadOf(fetched, "events", handle));
  const evs = events.success ? events.data : [];
  const n = (t: string): number => evs.filter((e) => e.type === t).length;
  const orgs = nonEmptyArray(Org).safeParse(payloadOf(fetched, "orgs", handle));
  const parsed = CodeProfile.safeParse({
    handle,
    profile_url: `https://github.com/${handle}`,
    repos_owned: mine.length,
    forks_excluded: mine.length - own.length,
    stats_pending: selected.map(fullName).filter((f) => !rowsOf.has(f)),
    repos,
    languages: languageCounts(own).map(([name, count]) => ({ name, repos: count })),
    stars_received: own.reduce((s, r) => s + (r.stargazers_count ?? 0), 0),
    merged_prs_elsewhere: search.success ? elsewhere(search.data).count : 0,
    merged_prs_sample: search.success ? elsewhere(search.data).merged.slice(0, 5).map((i) => ({ repo: repoOfUrl(i.repository_url), title: i.title, url: i.html_url, merged_at: i.pull_request?.merged_at ?? null })) : [],
    recent_events: { pushes: n("PushEvent"), pull_requests: n("PullRequestEvent"), issues: n("IssuesEvent"), reviews: n("PullRequestReviewEvent"), since: evs.map((e) => e.created_at).sort()[0] ?? null },
    orgs: orgs.success ? orgs.data.map((o) => o.login) : [],
    account_created: user.created_at ?? null,
    sources: urlsFor(handle),
  });
  return parsed.success ? parsed.data : null;
}

export const githubDeep: Collector = {
  id: "rest/github-deep",
  requests: (ctx) => {
    if (!isTechnicalFamily(ctx.roleFamily)) return [];
    return githubHandles(ctx).flatMap((h): CollectorRequest[] => {
      const u = urlsFor(h);
      return [u.user, u.repos, u.search, u.events, u.orgs].map((url) => ({ via: "fetch", url }));
    });
  },
  followUp: (ctx, _step, fetched) =>
    githubHandles(ctx).flatMap((h) => statsSelection(reposOf(fetched, h))).map((r): CollectorRequest => ({ via: "fetch", url: statsUrl(fullName(r)) })),
  parse: (payload, ctx, _step, req?: CollectorRequest) => parseOne(payload, ctx, req),
  digest: buildDigest,
};
