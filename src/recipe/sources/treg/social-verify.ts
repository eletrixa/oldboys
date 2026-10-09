/**
 * treg `social-verify` collector: a second, independent read of every confirmed public account (plans/016).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/treg/social-verify.ts
 * Deps:    src/domain/profile-facts, src/recipe/sources/{facts,types}, ./social-account, ./social-readers
 * Tested:  src/recipe/__tests__/treg-social-verify.test.ts
 *
 * Key responsibilities:
 * - `requests`: one treg profile read per merged candidate platform-handle, at most 6, $0.005 cap each
 * - `parse`: one Source per successful read (canonical profile URL, plain-sentence excerpt with every number so FACTs can quote it)
 * - `digest`: ProfileFacts of the merged accounts, `source_url` = the treg endpoint URL without any token
 * - `enriches`: the page is stored again as a second Source, so a FACT about it is doubly sourced
 *
 * Design constraints:
 * - Pure: no fetch; platform and handle come from the request, never from the payload
 * - Sensitive provider fields never reach the excerpt, raw or facts (the readers are allow-lists)
 */
import { PLATFORM_LABEL, facts } from "@/domain/profile-facts";
import { dedupeBy, digestOf } from "@/recipe/sources/facts";
import { acceptedCandidates, clip, type Collector, type CollectorRequest, type Fetched, identityFor, type ParsedSource, type StepContext } from "@/recipe/sources/types";
import type { Account, Reader, TregParams } from "@/recipe/sources/treg/social-account";
import { READERS } from "@/recipe/sources/treg/social-readers";

const MAX_REQUESTS = 6;
const MAX_COST_USD = 0.005;
const yesNo = (v: boolean): string => (v ? "yes" : "no");
const n = (v: number): string => String(v);

type Read = { reader: Reader; params: TregParams; url: string; account: Account };

function readerOf(req: CollectorRequest | undefined): { reader: Reader; params: TregParams } | null {
  if (req?.via !== "treg") return null;
  const reader = READERS.find((r) => r.endpoint === req.endpoint);
  return reader === undefined ? null : { reader, params: req.params };
}

function readOf(payload: unknown, req: CollectorRequest | undefined): Read | null {
  const found = readerOf(req);
  if (found === null) return null;
  const account = found.reader.read(payload, found.params);
  return account === null ? null : { ...found, url: found.reader.profileUrl(found.params), account };
}

function sentences({ reader, account: a }: Read): string {
  const label = PLATFORM_LABEL[reader.platform] ?? reader.platform;
  const subject = `The ${label} ${reader.kind}${a.handle === null ? "" : ` @${a.handle}`}${a.name === null ? "" : ` (${a.name})`}`;
  const parts = [
    ...(a.followers === null ? [] : [`has ${n(a.followers)} followers`]),
    ...(a.following === null ? [] : [`follows ${n(a.following)} accounts`]),
    ...(a.connections === null ? [] : [`has ${n(a.connections)} connections`]),
    ...(a.posts === null ? [] : [`has ${n(a.posts)} ${reader.postsLabel}`]),
  ];
  const counts = parts.length === 0 ? [] : [`${subject} ${parts.length === 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1) ?? ""}`}.`];
  return [
    ...counts.length === 0 ? [`${subject}.`] : counts,
    ...(a.verified === null ? [] : [`Verified badge: ${yesNo(a.verified)}.`]),
    ...(a.premium === null ? [] : [`Premium: ${yesNo(a.premium)}.`]),
    ...(a.open_to_work === null ? [] : [`Open to work: ${yesNo(a.open_to_work)}.`]),
    ...(a.created_at === null ? [] : [`Created: ${a.created_at}.`]),
    ...(a.first_year === null ? [] : [`The earliest listed position starts in ${n(a.first_year)}.`]),
    ...a.extras,
    ...(a.bio === null ? [] : [`Bio: ${a.bio}`]),
    `Read by ${reader.provider} via treg (second source; the Apify scrape is the first).`,
  ].join(" ");
}

const sourceUrl = (endpoint: string, params: TregParams): string =>
  `https://treg.to/call/${endpoint}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`;

/** Platform + the lower-cased handle (channel id, profile URL): the first param is always that identifier. */
function dedupeKey(r: CollectorRequest): string {
  if (r.via !== "treg") return "";
  const id = Object.values(r.params)[0];
  const platform = READERS.find((x) => x.endpoint === r.endpoint)?.platform ?? r.endpoint;
  return id === undefined ? "" : `${platform}|${String(id).toLowerCase()}`;
}

export const tregSocialVerify: Collector = {
  id: "treg/social-verify",
  enriches: true,
  requests: (ctx: StepContext) => {
    const reqs = acceptedCandidates(ctx).flatMap((c): CollectorRequest[] => {
      const reader = READERS.find((r) => r.platform === c.platform);
      const params = reader?.request(c) ?? null;
      return reader === undefined || params === null ? [] : [{ via: "treg", endpoint: reader.endpoint, method: reader.method, params, maxCostUsd: MAX_COST_USD }];
    });
    return dedupeBy(reqs, dedupeKey).slice(0, MAX_REQUESTS);
  },
  skipReason: () => "no confirmed social account to read a second time",
  parse: (payload, ctx, _step, req): ParsedSource[] => {
    const r = readOf(payload, req);
    return r === null ? [] : [{ url: r.url, excerpt: clip(sentences(r)), raw: { endpoint: r.reader.endpoint, ...r.account }, identity: identityFor(ctx, r.url) }];
  },
  digest: (fetched: readonly Fetched[], ctx) =>
    digestOf(
      dedupeBy(
        fetched.flatMap((f) => readOf(f.payload, f.req) ?? []),
        (r) => r.url.toLowerCase(),
      )
        .filter((r) => identityFor(ctx, r.url) === "merged")
        .map(({ reader, params, url, account: a }) =>
          facts(reader.platform, url, {
            handle: a.handle, display_name: a.name, created_at: a.created_at, followers: a.followers, following: a.following, posts: a.posts,
            connections: a.connections, verified: a.verified, premium: a.premium, open_to_work: a.open_to_work, bio: a.bio, photo_url: a.photo_url,
            earliest_experience_year: a.first_year, source_url: sourceUrl(reader.endpoint, params),
          }),
        ),
    ),
};
