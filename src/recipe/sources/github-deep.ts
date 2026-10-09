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
 * - `parse`: every payload becomes plain-sentence excerpts with numbers, so the extract seam can quote them as FACTs
 * - `digest`: one `CodeProfile` (src/domain/code-profile.ts) for the handle with more own repos
 *
 * Design constraints:
 * - Pure: no fetch here. Payloads of search, events and orgs carry no handle: search uses `items[].user.login`, events
 *   `actor.login`, orgs fall back to the only accepted handle, else the first one
 * - A stats payload carries no repo name: `parse` reads it from the request (4th argument); `digest` aligns stats payloads with
 *   the requested repos by order and, when counts differ (a request failed), reports every repo as pending instead of guessing
 * - About 22 GitHub requests per step at most (5 per handle + 12 stats)
 */
import { z } from "zod";
import { CodeProfile, isTechnicalFamily } from "@/domain/code-profile";
import type { Collector, CollectorRequest, ParsedSource, StepContext } from "@/recipe/sources/types";
import { acceptedCandidates, clip, identityFor } from "@/recipe/sources/types";

const API = "https://api.github.com";
const MAX_HANDLES = 2;
const MAX_STATS_REPOS = 6;
const PER_PAGE = 10;

const User = z.object({ login: z.string(), html_url: z.string().optional(), name: z.string().nullish(), bio: z.string().nullish(), company: z.string().nullish(), location: z.string().nullish(), public_repos: z.number().optional(), followers: z.number().optional(), created_at: z.string().nullish() });
const Repo = z.object({ name: z.string(), html_url: z.string(), owner: z.object({ login: z.string() }), fork: z.boolean().optional(), archived: z.boolean().optional(), pushed_at: z.string().nullish(), stargazers_count: z.number().optional(), language: z.string().nullish(), size: z.number().optional() });
type Repo = z.infer<typeof Repo>;
const StatsRow = z.object({ total: z.number(), author: z.object({ login: z.string() }).nullish(), weeks: z.array(z.object({ w: z.number(), a: z.number(), d: z.number(), c: z.number() })) });
type StatsRow = z.infer<typeof StatsRow>;
const Search = z.object({ total_count: z.number(), items: z.array(z.object({ title: z.string(), html_url: z.string(), repository_url: z.string(), user: z.object({ login: z.string() }).nullish(), author_association: z.string().nullish(), pull_request: z.object({ merged_at: z.string().nullish() }).nullish() })) });
const Event = z.object({ type: z.string(), created_at: z.string(), actor: z.object({ login: z.string() }).nullish() });
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

function handlesOf(ctx: StepContext): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of acceptedCandidates(ctx)) {
    const h = (c.handle ?? "").replace(/^@/, "");
    if (c.platform !== "github" || h === "" || seen.has(h.toLowerCase())) continue;
    seen.add(h.toLowerCase());
    out.push(h);
  }
  return out.slice(0, MAX_HANDLES);
}

const urlsFor = (h: string): { user: string; repos: string; search: string; events: string; orgs: string } => {
  const e = encodeURIComponent(h);
  const q = [`author:${h}`, "type:pr", "is:merged", `-user:${h}`].map(encodeURIComponent).join("+");
  return { user: `${API}/users/${e}`, repos: `${API}/users/${e}/repos?type=owner&sort=pushed&per_page=100`, search: `${API}/search/issues?q=${q}&per_page=10`, events: `${API}/users/${e}/events/public?per_page=100`, orgs: `${API}/users/${e}/orgs` };
};
const statsUrl = (fullName: string): string => `${API}/repos/${fullName}/stats/contributors`;

/** Own repos per handle from every repos payload, keyed by lower-case owner login. */
function reposByOwner(payloads: readonly unknown[]): Map<string, Repo[]> {
  const out = new Map<string, Repo[]>();
  for (const p of payloads) {
    const repos = nonEmptyArray(Repo).safeParse(p);
    if (!repos.success) continue;
    for (const r of repos.data) out.set(r.owner.login.toLowerCase(), [...(out.get(r.owner.login.toLowerCase()) ?? []), r]);
  }
  return out;
}

/** The repos worth a stats request: own, not fork, not archived, not empty, newest push first, at most six. */
function statsSelection(repos: readonly Repo[]): Repo[] {
  return repos
    .filter((r) => r.fork !== true && r.archived !== true && (r.size ?? 0) > 0)
    .sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? ""))
    .slice(0, MAX_STATS_REPOS);
}

const fullName = (r: Repo): string => `${r.owner.login}/${r.name}`;
const repoOfUrl = (url: string): string => url.split("/").slice(-2).join("/");

function statsLine(repo: string, handle: string, rows: readonly StatsRow[]): { text: string; row: StatsRow | null } {
  const row: StatsRow | null = rows.find((r) => r.author?.login.toLowerCase() === handle.toLowerCase()) ?? null;
  if (row === null) return { text: `${repo}: ${handle} made 0 commits (not among the contributors GitHub attributes commits to)`, row };
  const active = row.weeks.filter((w) => w.c > 0);
  const lines = (k: "a" | "d"): number => row.weeks.reduce((s, w) => s + w[k], 0);
  const all = rows.reduce((s, r) => s + r.total, 0);
  const iso = (w: number | undefined): string => (w === undefined ? "?" : new Date(w * 1000).toISOString().slice(0, 10));
  const share = all > 0 ? Math.round((row.total / all) * 100) : 0;
  return { text: `${repo}: ${handle} made ${String(row.total)} commits, +${String(lines("a"))} lines added, −${String(lines("d"))} lines removed, between ${iso(active[0]?.w)} and ${iso(active.at(-1)?.w)} (share of all commits ${String(share)}%)`, row };
}

function parseOne(payload: unknown, ctx: StepContext, req: CollectorRequest | undefined): ParsedSource[] {
  const handles = handlesOf(ctx);
  const source = (handle: string, url: string, excerpt: string, raw: unknown): ParsedSource[] => [{ url, excerpt: clip(excerpt), raw, identity: identityFor(ctx, `https://github.com/${handle}`) }];
  const only = handles[0] ?? "";
  if (payload === null) return []; // stats still computing: no source, the digest names the repo as pending
  const search = Search.safeParse(payload);
  if (search.success) {
    const h = search.data.items[0]?.user?.login ?? only;
    const { count, merged: all } = elsewhere(search.data);
    const merged = all.slice(0, 5);
    const eg = merged.map((i) => `${repoOfUrl(i.repository_url)}: ${i.title} (merged ${day(i.pull_request?.merged_at ?? "")})`);
    const text = `${plural(count, "pull request", "pull requests")} by ${h} merged into repositories of others${eg.length > 0 ? `, e.g. ${eg.join("; ")}` : ""}`;
    return source(h, `https://github.com/pulls?q=${encodeURIComponent(`is:pr author:${h} is:merged -user:${h}`)}`, text, payload);
  }
  const user = User.safeParse(payload);
  if (user.success) {
    const u = user.data;
    const parts = [u.name ?? u.login, u.bio, u.company, u.location, u.public_repos === undefined ? null : `${String(u.public_repos)} public repos`, u.followers === undefined ? null : `${String(u.followers)} followers`, typeof u.created_at !== "string" ? null : `account created ${day(u.created_at)}`];
    return source(u.login, u.html_url ?? `https://github.com/${u.login}`, parts.filter((x): x is string => typeof x === "string" && x.length > 0).join(" · "), payload);
  }
  const repos = nonEmptyArray(Repo).safeParse(payload);
  if (repos.success) {
    const h = repos.data[0]?.owner.login ?? only;
    const own = repos.data.filter((r) => r.fork !== true);
    const langs = [...languageCounts(own)].slice(0, 8).map(([n, c]) => `${n} (${plural(c, "repo", "repos")})`);
    const stars = own.reduce((s, r) => s + (r.stargazers_count ?? 0), 0);
    const cut = repos.data.length >= 100 ? " (the 100 most recently pushed only)" : "";
    return source(h, `https://github.com/${h}?tab=repositories`, `${plural(repos.data.length, "public repository", "public repositories")} owned, ${plural(repos.data.length - own.length, "fork", "forks")} excluded, languages: ${langs.join(", ") || "none"}, ${String(stars)} stars received across own repos${cut}`, payload);
  }
  const stats = nonEmptyArray(StatsRow).safeParse(payload);
  if (stats.success) {
    const m = req?.via === "fetch" ? /\/repos\/([^/]+\/[^/]+)\/stats\//.exec(req.url) : null;
    const name = m?.[1];
    if (name === undefined) return [];
    const h = handles.find((x) => name.toLowerCase().startsWith(`${x.toLowerCase()}/`)) ?? only;
    return source(h, `https://github.com/${name}/graphs/contributors`, statsLine(name, h, stats.data).text, payload);
  }
  const events = nonEmptyArray(Event).safeParse(payload);
  if (events.success) {
    const h = events.data[0]?.actor?.login ?? only;
    const n = (t: string): number => events.data.filter((e) => e.type === t).length;
    const oldest = events.data.map((e) => e.created_at).sort()[0];
    return source(h, `https://github.com/${h}?tab=overview`, `last 90 days of public activity: ${plural(n("PushEvent"), "push", "pushes")}, ${plural(n("PullRequestEvent"), "pull request", "pull requests")}, ${plural(n("IssuesEvent"), "issue", "issues")}, ${plural(n("PullRequestReviewEvent"), "review", "reviews")}${oldest === undefined ? "" : `, since ${day(oldest)}`}`, payload);
  }
  const orgs = nonEmptyArray(Org).safeParse(payload);
  if (orgs.success) return source(only, `${API}/users/${encodeURIComponent(only)}/orgs`, `member of organizations: ${orgs.data.map((o) => o.login).join(", ")}`, payload);
  return [];
}

function languageCounts(repos: readonly Repo[]): [string, number][] {
  const m = new Map<string, number>();
  for (const r of repos) if (typeof r.language === "string" && r.language !== "") m.set(r.language, (m.get(r.language) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function buildDigest(payloads: readonly unknown[], ctx: StepContext): unknown {
  const byOwner = reposByOwner(payloads);
  const users = payloads.flatMap((p) => { const u = Search.safeParse(p).success ? null : User.safeParse(p); return u?.success === true ? [u.data] : []; });
  const handles = handlesOf(ctx).filter((h) => users.some((u) => u.login.toLowerCase() === h.toLowerCase()));
  const handle = [...handles].sort((a, b) => (byOwner.get(b.toLowerCase())?.length ?? 0) - (byOwner.get(a.toLowerCase())?.length ?? 0))[0];
  const user = users.find((u) => u.login.toLowerCase() === handle?.toLowerCase());
  if (handle === undefined || user === undefined) return null;
  const mine = byOwner.get(handle.toLowerCase()) ?? [];
  const own = mine.filter((r) => r.fork !== true);
  // Stats payloads in request order (a null is a 202 that never became ready); the requests were built handle by handle.
  const requested = handlesOf(ctx).flatMap((h) => statsSelection(byOwner.get(h.toLowerCase()) ?? []));
  const statsPayloads = payloads.filter((p) => p === null || nonEmptyArray(StatsRow).safeParse(p).success);
  const aligned = statsPayloads.length === requested.length;
  const rowsOf = new Map<string, StatsRow[]>();
  requested.forEach((r, i) => {
    const parsed = aligned ? nonEmptyArray(StatsRow).safeParse(statsPayloads[i]) : null;
    if (parsed?.success === true) rowsOf.set(fullName(r), parsed.data);
  });
  const selected = statsSelection(mine);
  const repos = selected.flatMap((r) => {
    const rows = rowsOf.get(fullName(r));
    if (rows === undefined) return [];
    const { row } = statsLine(fullName(r), handle, rows);
    const active = row?.weeks.filter((w) => w.c > 0) ?? [];
    const iso = (w: number | undefined): string | null => (w === undefined ? null : new Date(w * 1000).toISOString().slice(0, 10));
    const all = rows.reduce((s, x) => s + x.total, 0);
    return [{ full_name: fullName(r), url: r.html_url, commits: row?.total ?? 0, additions: row?.weeks.reduce((s, w) => s + w.a, 0) ?? 0, deletions: row?.weeks.reduce((s, w) => s + w.d, 0) ?? 0, first_week: iso(active[0]?.w), last_week: iso(active.at(-1)?.w), language: r.language ?? null, stars: r.stargazers_count ?? 0, share: all > 0 ? (row?.total ?? 0) / all : null, source_url: statsUrl(fullName(r)) }];
  });
  const search = payloads.map((p) => Search.safeParse(p)).find((s) => s.success && (s.data.items[0]?.user?.login ?? handle).toLowerCase() === handle.toLowerCase());
  const events = payloads.map((p) => nonEmptyArray(Event).safeParse(p)).find((e) => e.success && (e.data[0]?.actor?.login ?? handle).toLowerCase() === handle.toLowerCase());
  const evs = events?.success === true ? events.data : [];
  const n = (t: string): number => evs.filter((e) => e.type === t).length;
  const orgs = (handlesOf(ctx).length === 1 || handlesOf(ctx)[0]?.toLowerCase() === handle.toLowerCase() ? payloads : []).flatMap((p) => { const o = nonEmptyArray(Org).safeParse(p); return o.success ? o.data.map((x) => x.login) : []; });
  const u = urlsFor(handle);
  const profile = {
    handle,
    profile_url: `https://github.com/${handle}`,
    repos_sampled: repos.length,
    repos_owned: mine.length,
    forks_excluded: mine.length - own.length,
    commits: repos.reduce((s, r) => s + r.commits, 0),
    additions: repos.reduce((s, r) => s + r.additions, 0),
    deletions: repos.reduce((s, r) => s + r.deletions, 0),
    stats_pending: selected.map(fullName).filter((f) => !rowsOf.has(f)),
    repos,
    languages: languageCounts(own).map(([name, count]) => ({ name, repos: count })),
    stars_received: own.reduce((s, r) => s + (r.stargazers_count ?? 0), 0),
    merged_prs_elsewhere: search?.success === true ? elsewhere(search.data).count : 0,
    merged_prs_sample: search?.success === true ? elsewhere(search.data).merged.slice(0, 5).map((i) => ({ repo: repoOfUrl(i.repository_url), title: i.title, url: i.html_url, merged_at: i.pull_request?.merged_at ?? null })) : [],
    recent_events: { pushes: n("PushEvent"), pull_requests: n("PullRequestEvent"), issues: n("IssuesEvent"), reviews: n("PullRequestReviewEvent"), since: evs.map((e) => e.created_at).sort()[0] ?? null },
    orgs,
    account_created: user.created_at ?? null,
    source_urls: [u.user, u.repos, u.search, u.events, u.orgs, ...selected.map((r) => statsUrl(fullName(r)))],
  };
  const parsed = CodeProfile.safeParse(profile);
  return parsed.success ? parsed.data : null;
}

export const githubDeep: Collector = {
  id: "rest/github-deep",
  requests: (ctx) => {
    if (!isTechnicalFamily(ctx.roleFamily)) return [];
    return handlesOf(ctx).flatMap((h): CollectorRequest[] => {
      const u = urlsFor(h);
      return [u.user, u.repos, u.search, u.events, u.orgs].map((url) => ({ via: "fetch", url }));
    });
  },
  followUp: (ctx, _step, payloads) => {
    const byOwner = reposByOwner(payloads);
    return handlesOf(ctx).flatMap((h) => statsSelection(byOwner.get(h.toLowerCase()) ?? [])).map((r): CollectorRequest => ({ via: "fetch", url: statsUrl(fullName(r)) }));
  },
  parse: (payload, ctx, _step, req?: CollectorRequest) => parseOne(payload, ctx, req),
  digest: buildDigest,
};
