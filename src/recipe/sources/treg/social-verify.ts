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
import { PLATFORM_LABEL, type ProfileFacts, facts } from "@/domain/profile-facts";
import { dedupeBy, digestOf } from "@/recipe/sources/facts";
import { acceptedCandidates, clip, type Collector, type CollectorRequest, type Fetched, identityFor, type ParsedSource, type StepContext } from "@/recipe/sources/types";
import type { Reader } from "@/recipe/sources/treg/social-account";
import { READERS } from "@/recipe/sources/treg/social-readers";

const MAX_REQUESTS = 6;
const MAX_COST_USD = 0.005;
const yesNo = (v: boolean): string => (v ? "yes" : "no");
const when = <T>(v: T | null | undefined, f: (v: T) => string): string[] => (v === null || v === undefined ? [] : [f(v)]);

type Params = Extract<CollectorRequest, { via: "treg" }>["params"];
type Read = { reader: Reader; params: Params; url: string; a: Partial<ProfileFacts>; extras: string[] };

function readOf(payload: unknown, req: CollectorRequest | undefined): Read | null {
  if (req?.via !== "treg") return null;
  const reader = READERS.find((r) => r.endpoint === req.endpoint);
  const id = String(Object.values(req.params)[0] ?? "");
  const read = reader?.read(payload, id) ?? null;
  if (reader === undefined || read === null) return null;
  const { extras = [], ...a } = read;
  return { reader, params: req.params, url: reader.profileUrl(id), a, extras };
}

function sentences({ reader, a, extras }: Read): string {
  const label = PLATFORM_LABEL[reader.platform] ?? reader.platform;
  const subject = `The ${label} ${reader.kind}${when(a.handle, (h) => ` @${h}`).join("")}${when(a.display_name, (v) => ` (${v})`).join("")}`;
  const parts = [
    ...when(a.followers, (v) => `has ${String(v)} followers`),
    ...when(a.following, (v) => `follows ${String(v)} accounts`),
    ...when(a.connections, (v) => `has ${String(v)} connections`),
    ...when(a.posts, (v) => `has ${String(v)} ${reader.postsLabel}`),
  ];
  return [
    parts.length === 0 ? `${subject}.` : `${subject} ${new Intl.ListFormat("en-GB").format(parts)}.`,
    ...when(a.verified, (v) => `Verified badge: ${yesNo(v)}.`),
    ...when(a.premium, (v) => `Premium: ${yesNo(v)}.`),
    ...when(a.open_to_work, (v) => `Open to work: ${yesNo(v)}.`),
    ...when(a.created_at, (v) => `Created: ${v}.`),
    ...when(a.earliest_experience_year, (v) => `The earliest listed position starts in ${String(v)}.`),
    ...extras,
    ...when(a.bio, (v) => `Bio: ${v}`),
    `Read by ${reader.provider} via treg (second source; the Apify scrape is the first).`,
  ].join(" ");
}

const sourceUrl = (endpoint: string, params: Params): string =>
  `https://treg.to/call/${endpoint}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`;

/** The endpoint maps 1:1 to a platform, so endpoint + lower-cased params is platform + handle (channel id, profile URL). */
const dedupeKey = (r: CollectorRequest): string => (r.via === "treg" ? `${r.endpoint}|${JSON.stringify(r.params).toLowerCase()}` : "");

export const tregSocialVerify: Collector = {
  id: "treg/social-verify",
  enriches: true,
  requests: (ctx: StepContext) => {
    const reqs = acceptedCandidates(ctx).flatMap((c): CollectorRequest[] => {
      const reader = READERS.find((r) => r.platform === c.platform);
      const id = reader?.request(c) ?? null;
      return reader === undefined || id === null
        ? []
        : [{ via: "treg", endpoint: reader.endpoint, method: reader.method, params: { [reader.param(id)]: id, ...reader.extra }, maxCostUsd: MAX_COST_USD }];
    });
    return dedupeBy(reqs, dedupeKey).slice(0, MAX_REQUESTS);
  },
  skipReason: () => "no confirmed social account to read a second time",
  parse: (payload, ctx, _step, req): ParsedSource[] => {
    const r = readOf(payload, req);
    return r === null ? [] : [{ url: r.url, excerpt: clip(sentences(r)), raw: { endpoint: r.reader.endpoint, ...r.a, extras: r.extras }, identity: identityFor(ctx, r.url) }];
  },
  digest: (fetched: readonly Fetched[], ctx) =>
    digestOf(
      dedupeBy(
        fetched.flatMap((f) => readOf(f.payload, f.req) ?? []),
        (r) => r.url.toLowerCase(),
      )
        .filter((r) => identityFor(ctx, r.url) === "merged")
        .map(({ reader, params, url, a }) => facts(reader.platform, url, { ...a, source_url: sourceUrl(reader.endpoint, params) })),
    ),
};
