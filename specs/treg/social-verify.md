# Unit: treg `social-verify` collector (second independent read of confirmed social accounts)

Plan: `plans/016-treg-enrichment/00-SYNTHESIS.md`. Pure collector, no fetch; the runner executes the `via: "treg"` requests.

## Purpose
- A second reading of every merged public account (counts, bio, creation date) next to the Apify scrape, so a FACT about it is doubly sourced and contradictions surface through claim rank.
- Feeds `ProfileFacts[]` (digest) to the profile-signals card; `mergeAccounts` combines both readings.

## Files
- `src/recipe/sources/treg/social-verify.ts` (`tregSocialVerify`), `social-readers.ts` (`READERS`: linkedin, x, youtube, facebook and the merged table), `social-readers-tikhub.ts` (`TIKHUB_READERS`: instagram, tiktok), `social-account.ts` (`Read`, `Reader`, helpers).
- Test: `src/recipe/__tests__/treg-social-verify.test.ts`. Consumers: `src/domain/profile-facts.ts`, `src/domain/profile-signals.ts` (`mergeAccounts`).

## Inputs
- `Collector` `id: "treg/social-verify"`, `enriches: true`, used by the hiring and due-diligence recipes as step `treg_social_verify` (collect pool, after the lineup).
- `requests(ctx)`: candidates with `decision === "merge"` (`acceptedCandidates`).
- `parse(payload, ctx, step, req)` and `digest(fetched, ctx)`: the treg response payload plus the originating `req` (`via: "treg"`).

## Outputs
Requests, one per merged candidate per platform, all `{ via: "treg", maxCostUsd: 0.005 }`:

| platform | endpoint | method | params | cost |
|---|---|---|---|---|
| linkedin | `fetchinio.linkedin.user.profile` | GET | `profileUrlOrUrn` = `profile_urls[0]` | $0.0015 |
| instagram | `tikhub.instagram.user.profile` | GET | `username` = handle without `@` | $0.001 |
| tiktok | `tikhub.tiktok.user.profile` | GET | `uniqueId` = handle without `@` | $0.001 |
| x | `anyapi.x.user.profile` | POST | `handle` = handle without `@` | $0.00022 |
| youtube | `scrapecreators.youtube.channel.profile` | GET | `handle`; `channelId` when the handle matches `^UC[\w-]{20,}$`; `url` = the candidate's own profile URL when it is a legacy `/c/…` or `/user/…` URL | $0.00188 |
| facebook | `scrapecreators.x.v1-facebook-profile` | GET | `url` = `profile_urls[0]`, `cache_max_age: "7d"` | $0.00188 |

- Dedupe by platform + handle (profile URL for linkedin and facebook), case-insensitive; at most 6 requests (`MAX_REQUESTS`).
- Candidate without handle (or without profile URL for linkedin/facebook) or with another platform: no request.
- `skipReason`: "no confirmed social account to read a second time".
- `parse`: one `ParsedSource` per successful read:
  - `url` = canonical profile URL (`https://www.instagram.com/<h>/`, `https://www.tiktok.com/@<h>`, `https://x.com/<h>`, `https://www.youtube.com/@<h>` or `/channel/<id>` (a legacy `/c/` or `/user/` URL stays the candidate's own URL), the given LinkedIn/Facebook URL).
  - `excerpt` = `clip(plain sentences)`: `The <Platform> <kind> @<handle> (<name>) has N followers, follows N accounts, has N connections and has N <posts|videos>.`, then `Verified badge: yes|no.`, `Premium: …`, `Open to work: …`, `Created: …`, `The earliest listed position starts in YYYY.`, platform extras (Facebook `Category:`, `The account has N likes.`, `Website:`), `Bio: …`, and a closing `Read by <provider> via treg …`. Every number the read has is in a sentence so a FACT can quote it; the provider name (Fetchin, TikHub, AnyAPI, ScrapeCreators) is always present. Kind: profile (linkedin), account (all others; Facebook is always "account" because the endpoint serves pages and profiles).
  - `raw` = `{ endpoint, ...Read }`, allow-listed fields only.
  - `identity` = `identityFor(ctx, url)`.
  - Because `enriches: true`, the runner stores this page as a second Source beside the Apify one for the same URL.
- `digest`: `ProfileFacts[]` (via `digestOf`) for accounts with `identityFor === "merged"` only, deduped by lower-cased profile URL; `source_url` = `https://treg.to/call/<endpoint>?<params>` built from request params only (the token travels in a header and never appears); `handle` from the request, never the payload.

## Rules
- Platform and handle (and so URL and `ProfileFacts.handle`) come from the request params, never from the payload.
- Readers are allow-lists with every provider field `.nullish()`; a field not named is dropped.
- Facebook `gender`, `email`, `phone`, `address` (and any other unnamed field) never reach excerpt, raw or facts; `reveal_*` flags are never sent.
- `output.found === false` (X), `success === false` (YouTube, Facebook), a null user (Instagram, TikTok), a LinkedIn payload without id, publicIdentifier, firstName and title, or any malformed or foreign payload: `parse` returns `[]` and the digest has no entry.
- Counts pass `count()` (non-negative integer or null); bio passes `clipBio` (≤ `BIO_MAX` 300). Instagram `edge_owner_to_timeline_media.count === 0` is unknown, not a fact: TikHub answers 0 for public accounts it cannot enumerate, so `posts` is null and the "has N posts" phrase is left out (V9).
- `mergeAccounts` (`profile-signals.ts`): key `platform|canonicalUrl(url)`; the first reading is kept as base and its `url` stays; for each later reading every non-null field overrides (including `source_url`, so the merged fact points at the later reading's treg URL), a null never erases an earlier value. Apify then treg order: treg numbers win, Apify values survive where treg is null.
- Cost: runner reserves `maxCostUsd` against the run USD budget; no Apify allowance slot, `out.calls` not incremented; `ports.callTreg === null` → no request, note "TREG_TOKEN not set".

## Failure modes
- No merged candidate or no readable handle: `requests` is `[]`.
- Provider HTTP error (402 balance exhausted, 503 capacity), timeout, or missing `req`/non-treg `req`: no Source, no fact, the step notes the error; the Apify reading stands alone.
- Unknown endpoint in `req`: `[]`.
- Account not merged (namesake, possibly-same-as): Source may exist with its identity, but no `ProfileFacts`.

## Tests that prove it
(`treg-social-verify.test.ts`, extend where a line has no case)
- One request per platform with the table's endpoint, method, params and `maxCostUsd 0.005`; facebook carries `cache_max_age: "7d"`.
- UC id becomes `channelId`; duplicate handle (any case) collapses; missing handle and unmerged candidates skipped; more than 6 candidates cut to 6; empty with no merged candidates and the skip reason.
- `parse`: excerpt holds every number, the provider name and the canonical URL; raw has only allow-listed fields; handle comes from params when the payload disagrees.
- Facebook `gender`/`email`/`phone`/address never in excerpt or raw.
- `output.found: false`, `success: false`, malformed and foreign payloads give `[]`.
- `digest`: merged accounts only, `source_url` is the treg URL and contains no token; null when nothing merged.
- `mergeAccounts` (in `profile-signals` tests): Apify + treg of one URL give one fact set, later non-null wins, null does not erase, first `url` kept.

## Deviations in code (for the refactor pass)
- Deviation in code: `parse` raw includes `photo_url` and `extras`, beyond the dossier's "allow-listed raw" (still allow-listed, but not named in the dossier). (still open)
