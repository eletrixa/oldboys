# 00 — Synthesis: LinkedIn profile suggestions on the start form

**Question.** How should the "Start a brief" card suggest public LinkedIn profiles from a typed name so the recruiter picks one instead of hunting for the URL, within the brief's hard rules (public data only, no LinkedIn login, honesty about identity) and the repo's constraints (session-gated routes, server-side caps, no LLM in the loop)?

**Scope.** One suggest route, one pure parser, one picker component on the existing form. **Out of scope:** identity decisions, persistence of suggestions, extension, intake, `/api/runs`.

## Contracts

| Unit | Contract |
|---|---|
| `src/domain/profile-suggest.ts` | `suggestQuery(name, hint)` → `site:linkedin.com/in "<name>" <hint>`; `parseProfileTitle(title)` → `{name, headline}` from `Name - Headline - Company \| LinkedIn` (any of `-`, `–`, `\|` as separators, suffix optional); `suggestionsFromHits(hits, max=8)` → `Suggestion[]` keeping only `linkedin.com/in/` URLs that `normalizeLinkedinProfile` accepts, deduped by normalised URL, order preserved |
| `GET /api/profiles/suggest?q=&hint=` | same-origin (403), session (401), `q` trimmed 3..100 chars else 400, cap `SUGGEST_PER_HOUR_PER_ACCOUNT = 60` via `auth_attempts` kind `suggest` subject accountId (429), 503 `{error:"suggest unavailable"}` when `BRAVE_SEARCH_KEY` is unset, 502 on provider failure, 200 `{suggestions: Suggestion[], source: "web-search"}`; `Cache-Control: no-store` |
| Handler `suggestProfiles(q, hint, deps)` | `deps = {fetchJson, key}`; one Brave call `count=20`, `country=cz` default; no cache (results are per name, per minute) |
| Picker `src/app/profile-picker.tsx` | one text field "Candidate's LinkedIn profile or name"; a pasted `linkedin.com/in/` URL is used as-is; otherwise "Find profiles" button (Enter also triggers) → listbox of ≤8 rows (name, headline, location-less, handle), arrow keys + Enter, pick → chosen card with "Change"; hidden `profileUrl` input carries the value so `start-form.tsx` submit is unchanged; 503/429/502 → calm copy and the plain field keeps working |
| Migration `0014_suggest_attempts.sql` | rebuilds `auth_attempts` so `kind` allows `suggest` (SQLite cannot alter a CHECK) |

## Decision matrix

Weights are the default set from the method; delivery speed raised to 15 % and domain fit lowered to 10 % because this is a hackathon form field, not a bounded context.

| Criterion | W | A Brave | B Apify SERP | C Apify people | D defer |
|---|---|---|---|---|---|
| Simplicity & operability | 20 | 4 (one REST call, one secret; 01-B1) | 3 (actor run per lookup, $0.50 cap quirk; 01-A) | 3 (actor run; 01-B4) | 5 |
| Agentic-dev fit | 20 | 5 (ARES-shaped handler, fake fetch; 02-§7) | 4 (actor fake exists; 02-§7) | 3 (structured but new payload shape) | 5 |
| Domain fit | 10 | 4 (snippet = candidate, honest; 02-§1) | 4 | 3 (vendor search blurs the public-data line; 04-C) | 2 (no product change) |
| Evolution & headroom | 15 | 4 (fetcher swap; 02-§4) | 4 | 2 (legal cliff; 02-§2) | 3 |
| Testability | 10 | 5 (pure parser + handler test) | 4 | 4 | 5 |
| Delivery speed | 15 | 4 (new key to obtain) | 4 | 3 | 5 |
| Cost | 5 | 4 ($0.005; 01-B1) | 5 ($0.002; 01-B3) | 2 ($0.10; 01-B4) | 5 |
| Risk & reversibility | 5 | 4 | 4 (latency kills the UX; 04-B) | 1 (Proxycurl; 02-§2) | 5 |
| **Weighted** | | **4.30** | **3.85** | **2.85** | **4.45** |

D scores highest on the matrix because it changes nothing. It is rejected in prose: the request is a suggester on the card, and D does not deliver it; its score measures the absence of work. Among the options that deliver, **A wins** and survives the sensitivity check (swapping Simplicity with Agentic-fit, or Delivery with Evolution, keeps A above B by ≥ 0.3).

## Recommendation: A, Brave Search behind one function

Top reasons:
1. Sub-second answers make it a real našeptávač; B is a button that waits twenty seconds.
2. No traffic to linkedin.com from the picker; the only LinkedIn read stays the one chosen profile in the seed step, which keeps the honesty story intact.
3. The provider is one function parameter (`fetchJson` plus a URL builder); B is the named fallback if Brave's coverage of Czech names disappoints on the demo subjects.

Top risks (from 04-A prosecution):
1. Coverage of Czech names on Brave is unknown → verify on three demo subjects at build time; hint field (company/city) and an honest empty state.
2. Title parsing drift → keep every `/in/` hit even when the title does not split; tests on real titles.
3. Key or credit missing on demo day → 503 path makes the field behave exactly as today; the form never blocks.

```mermaid
flowchart LR
  subgraph Browser
    P[profile-picker.tsx] --> SF[start-form.tsx]
  end
  P -->|GET /api/profiles/suggest?q&hint| RT[route.ts: same-origin, session, cap]
  RT --> H[handler.ts suggestProfiles]
  H -->|fetchJson X-Subscription-Token| BR[(Brave Web Search)]
  RT -->|auth_attempts kind=suggest| D1[(D1)]
  SF -->|POST /api/start profileUrl| CR[createRun → seed (harvestapi, unchanged)]
```

## Pre-mortem on the winner
See `docs/15-profile-suggest-pre-mortem.md`.

## First TDD steps
1. `src/domain/__tests__/profile-suggest.test.ts`: titles `Jan Novák - Data Engineer - Seznam | LinkedIn`, `Jan Novák | LinkedIn`, en dash, no suffix; dedupe `cz.linkedin.com/in/jan-novak?trk=x` with `www.linkedin.com/in/jan-novak`; drop `/company/`, `/posts/`, `/pub/dir/`; max 8.
2. `src/app/api/profiles/__tests__/suggest.test.ts`: fake fetch returns a Brave payload → 200 with parsed suggestions; empty `web` → 200 empty; fetch throws → 502; no key → 503; short `q` → 400.
3. Handler and route, then the picker; `pnpm check`; dry-run bundle.

Flip `status: draft` → `active` in `README.md` when the decision is accepted.
