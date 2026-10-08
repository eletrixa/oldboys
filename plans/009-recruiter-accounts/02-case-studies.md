# 02 — Case studies: sessions on Workers, PBKDF2, OpenNext, ARES

---

## Hand-rolled sessions vs. libraries on Workers

**Lucia (by zaiste):** The Lua-inspired session library for TypeScript was widely used. In 2024, the author deprecated it in favor of a guide to rolling your own sessions (https://lucia-auth.com/getting-started/). Reasoning: sessions are not complex; most of the library's code is database adapters and email flows, which are app-specific. A hand-rolled solution is 50 lines of code for D1, transparent, and easier to audit.

**Session shape on D1:** One table, `sessions(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE, account_id TEXT, created_at TEXT, expires_at TEXT)`. On login, generate a 43-character base64url token (32 random bytes), hash it with SHA-256 (for storage), and send the plaintext token in a `Set-Cookie` header (HttpOnly). On every request, read the token from the cookie, hash it, and look it up in the session table. Expired rows are checked against `expires_at` and cleaned up nightly.

**Performance:** One indexed lookup per request. D1 returns <10 ms latency on a small table. KV is faster but requires a separate binding and has consistency implications (cache invalidation on logout).

**Trade-off:** Session tokens are mutable (each login is a new token); they are short-lived (30 days); they are cryptographically sound (not guessable). No race conditions or replay attacks if the token is hashed in storage.

---

## PBKDF2 on Cloudflare Workers

**WebCrypto support:** Workers expose `globalThis.crypto.subtle.deriveKey` for PBKDF2. Documented iteration limit: **100,000** (hard cap in the Workers runtime). Higher iterations (e.g., Argon2 at millions) are not available.

**Format:** `pbkdf2$100000$<salt b64>$<hash b64>`. Salt is 16 bytes (128 bits), randomly generated per password. Hash is 32 bytes (SHA-256). Base64 encoding uses the standard alphabet (not URL-safe) for readability. Storage size: ~80 characters.

**Performance:** 100 ms per hash on local tests (varies by device). Workers' CPU time limit is ≥1 second per request, so one hash per registration or login is well within budget. Measure in preview before deploy.

**Round-trip:** `hashPassword("example123")` → `verifyPassword("example123", stored)` uses `timingSafeEqual` to prevent timing attacks on password comparison.

**Gotcha:** `crypto.subtle.deriveKey` is async and returns a `CryptoKey`, not a buffer. Convert to buffer via `crypto.subtle.exportKey("raw", derivedKey)` and then to base64 for storage.

---

## OpenNext and Set-Cookie on Workers

**How it works:** OpenNext's Cloudflare adapter transforms Next.js route handlers into Workers request handlers. When a route handler calls `Response.json(body, { headers: { "Set-Cookie": ... } })`, the header is passed through to the Workers Response without modification.

**Middleware vs. routes:** Cloudflare's `middleware.ts` (if present) runs before route handlers. Do not set `runtime = "edge"` on route handlers — that changes the execution context and may strip headers. Leave it unset (or explicitly `runtime = "nodejs"` is not available on Workers, but the default is correct).

**Next.js `cookies()`:** The `cookies()` function from `next/headers` is compatible with Workers. When you call `(await cookies()).set(...)` in a Server Component or route handler, it sets the response header internally. The Response body carries the `Set-Cookie` header.

**HttpOnly and Secure flags:** Set them explicitly: `response.headers.set("Set-Cookie", "name=value; Path=/; HttpOnly; SameSite=Lax; Secure")` when the request is HTTPS. For development (`pnpm preview` on http://127.0.0.1:8787), omit `Secure` so the cookie is set on plain HTTP.

**Testing:** In `pnpm preview`, open DevTools and check Application → Cookies. The cookie should appear as HttpOnly, SameSite=Lax, and Path=/. No `Secure` flag on http.

---

## ARES API terms and caching

**Official sources:**
- Developer pages: https://ares.cz/pro-vyvojare/ares-api/
- Swagger UI: https://ares.gov.cz/swagger-ui/
- OpenAPI spec: https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/v3/api-docs

**Prohibition on repeating queries:** The API terms forbid sending the same query multiple times. Practical interpretation: cache identical lookups (by IČO) for at least 24 hours. Repeat the same IČO in the same hour → serve from cache. Violation: making 10 identical requests in a loop, even if seconds apart.

**Practical caching:** Store `(ico, status, payload_json, fetched_at)` in D1 `ares_cache`. On lookup, check cache first. If cache is stale (>24 hours old) or absent, fetch. Always store the result (both `found` and `not_found` statuses are cached). This honors the terms and cuts network calls dramatically.

**Rate limit:** 500 requests/minute (not documented per-IP; assume shared across all clients). For the demo, with 10–50 users, unlikely to hit. No rate-limit headers in responses to check.

**Status codes:** 200 (found), 404 (not found), 400 (bad format). Assume any network error or 5xx as "temporary unavailable" and fallback to manual company-name entry.

---

## Worker egress IP and geographic blocking

**Known issue:** Cloudflare Workers' egress IP is shared across all Workers on the same region. Some APIs geo-block or rate-limit shared IPs. ARES does not document an IP allowlist, and the question is:

*Does ARES accept requests from Cloudflare Workers' IP range?*

**Test needed:** Call `GET https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/27074358` from the live deployed Worker (`oldboys.asajj.cz/api/ares/27074358`) and confirm a 200 response. If 403 or 429, the answer is no and the manual path is the fallback.

**Assumption label:** UNCONFIRMED. Mitigation: Manual company-name path is always available.

---

## Key learnings for the options

1. **Hand-rolled is not reckless.** Lucia's author endorses it; it is transparent and testable with fake D1.
2. **PBKDF2 100k is the limit, not a recommendation.** Verify timing in preview; if >300 ms, escalate.
3. **Set-Cookie works on OpenNext + Workers.** The hard part is not setting headers; it is verifying the flag combinations (HttpOnly, SameSite, Secure) are correct.
4. **ARES caching is mandatory, not optional.** The API forbids repeating queries. Design around it from day one.
5. **ARES egress-IP acceptance is uncertain.** Test once; if it fails, the entire feature pivots to manual company entry (a simpler, slower path).
