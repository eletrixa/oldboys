# 01 — Deep dive: codebase and platform facts

---

## Codebase starting state

**Users today:** None. The web app is stateless; `/roles` accepts a shared `RUN_TOKEN` pasted by the user. `POST /api/start` (the form submission) takes no auth; it adds the token server-side to every run.

**Handler test pattern:** `src/app/api/webhooks/__tests__/elevenlabs.test.ts` shows how to test a route handler with a fake D1 database. It dispatches on SQL prefixes and maintains state in Maps. No Next.js request mocking. This is the pattern for WP-B and WP-C tests.

**D1 tables today:** `investigations` (run metadata), `claims`, `gaps`, `sources`, `ledger_entries`, `calls`. Schema in `migrations/0007_*`. No users or organizations.

**Extension:** `extension/` folder (WXT codebase). Uses bearer `POST /api/runs` and opens `/runs/:id` by UUID without authentication. Must remain untouched.

**Routes:** `/`, `/roles`, `/briefs`, `/runs/:id` all public. `POST /api/runs` and `GET /api/runs/:id` both public. `POST /api/start` today is public (the form wrapper around `/api/runs`).

**Tailwind v4, Zod 4, TypeScript 6.x (peer cap <6.1.0 from eslint).**

---

## ARES REST API fact sheet

**Live calls against `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/` (2026-10-08):**

- **Endpoint:** `GET /ekonomicke-subjekty/{ico}` where `ico` is exactly 8 digits (zero-padded).
- **Response (200):** JSON object with `ico`, `obchodniJmeno` (company name), `dic` (VAT ID, optional), `pravniForma` (legal form code, e.g., "112" for s.r.o., "121" for a.s.), `sidlo` (address: `textovaAdresa`, `nazevObce`, `nazevUlice`, `cisloDomovni`, `cisloOrientacni`, `psc`), `datumVzniku` (founding date, optional, public bodies may omit).
- **Error (404):** `{kod:"NENALEZENO", popis, subKod:"VYSTUP_SUBJEKT_NENALEZEN"}` — company not found.
- **Error (400):** `{kod:"CHYBA_VSTUPU", subKod:"VSTUP_NEVALIDNI_FORMAT_ICO"}` — malformed IČO (e.g., 7 digits, non-numeric).
- **Timeout / network failure:** No documented guarantee; assume up to 5 seconds, then fallback to manual path.
- **Terms:** Free, no API key, `access-control-allow-origin: *`. Documented limit: 500 queries/minute. Prohibited: repeating the same query, repeating malformed queries, batch queries from many simultaneous IPs. **Caching identical queries is forbidden by the API terms** → cache ARES responses 24 hours in the `ares_cache` table and always serve from cache on subsequent requests.
- **Worker egress-IP acceptance:** UNCONFIRMED (test with one real call from the deployed Worker at T+6h).
- **IČO checksum:** `s = 8·d₀ + 7·d₁ + 6·d₂ + 5·d₃ + 4·d₄ + 3·d₅ + 2·d₆`; `r = s mod 11`; `check = (11 − r) mod 10`; valid iff `d₇ == check`. Valid examples: 27074358 (Asseco), 00006947 (Czech government), 25596641. Invalid: 12345678.

---

## Platform facts

**Cloudflare Workers WebCrypto:** `globalThis.crypto.subtle` supports PBKDF2. Iteration cap: **100,000** (documented in Cloudflare Workers runtime docs). No bcrypt or Argon2 in WebCrypto; both require native code.

**OpenNext on Workers:** Route handlers can return `Set-Cookie` headers. The `cookies()` function from `next/headers` works. **Do not set `runtime = "edge"`** on route handlers — that disables the proxy. No `proxy.ts` support; use `middleware.ts` for global checks. Session cookies set by handlers pass through to the browser.

**Existing repo patterns:** Bearer token auth in `src/app/api/_lib/auth.ts` (`requireBearer`). No user sessions. Tests use a fake D1 with SQL prefix dispatch.

---

## Evolution and constraints

**Worktree:** This work runs in its own Git worktree at `/home/asajj/code/oldboys-accounts` on branch `accounts`, off `main`. Merges into `main` when all success criteria are green.

**Migration:** `0008_accounts.sql` creates `organizations`, `accounts`, `sessions`, `auth_attempts`, `ares_cache` tables and alters `investigations` to add `account_id` and `organization_id` columns. Applied before deploy via `pnpm db:migrate:remote`.

**Lint:** TypeScript 6.x. ESLint rules: `strict-boolean-expressions`, `explicit-module-boundary-types`, `consistent-type-definitions: type` (no `interface`), `restrict-template-expressions`, `no-floating-promises`, `noUncheckedIndexedAccess`, `prefer-nullish-coalescing`. Zod 4: `.z.email()`, `.default()` after `.nullable()`.

**Tests:** Unit tests for domain modules in `src/domain/__tests__/`. Route handlers tested with fake D1 (SQL prefix dispatch). Integration smoke in `scripts/auth-flow.mjs` against `pnpm preview` (local D1, local Workflow).

**Headers:** Every new file carries a header from `rules/file-headers.md`. Format: Project, Module, Deps, Tested.

---

## Facts used in options analysis

- **Zero new dependencies.** Use WebCrypto (built-in), D1 (already binding), Next.js routes (already used).
- **Existing test infrastructure.** Fake D1 pattern proven in `webhooks/__tests__/elevenlabs.test.ts`.
- **One standard secret.** ANTHROPIC_API_KEY already in production; no new secrets needed for auth (PBKDF2 uses random salt per password).
- **ARES terms forbid repeating queries.** Caching is mandatory, not optional. One IČO = one ARES call per 24 hours.
- **Session TTL = 30 days.** Cookie is `Max-Age=2592000` (30 × 24 × 60 × 60 seconds).
- **Extension untouched.** Bearer `/api/runs` stays open; extension e2e is the validation.
