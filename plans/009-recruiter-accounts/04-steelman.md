# 04 — Steelman: advocate and prosecutor per option

---

## Option A: Hand-rolled email + password, D1 sessions, WebCrypto PBKDF2

### Advocate for A

1. **Transparency.** Every line of auth code is in the codebase. Reviewers and future maintainers see exactly what happens to a password (PBKDF2 100k, random salt, base64 storage). No magic, no hidden dependency vulnerabilities.

2. **Proven pattern.** Lucia's author explicitly deprecated the library in favor of hand-rolled sessions because they are simple and auditable. The codebase already uses this pattern in `webhooks/__tests__/elevenlabs.test.ts` (fake D1 with SQL dispatch). Reusing the pattern reduces the cognitive load.

3. **Agentic fit.** Contracts are explicit (function signatures, SQL prefixes, test cases). Agents can code in parallel with no blocking decisions. The test style is known.

4. **Simplicity.** PBKDF2 is 100 lines (including round-trip hashing and timing-safe comparison). Sessions are 50 lines (token generation, hashing, cookie strings). No package-lock complexity or semver surprises.

5. **Testability.** Both unit tests (domain) and handler tests (fake D1) are straightforward. Timing-attack resistance can be verified. No external mocks needed beyond what the codebase already has.

### Prosecutor A

1. **Custom crypto is a liability.** Even WebCrypto is easy to misuse. If the salt is not random enough, or if the iteration count is wrong, passwords are weak. We are trusting developers to read the Cloudflare docs correctly.

2. **PBKDF2 is not the strongest option.** Argon2 and bcrypt are better, but they are not in WebCrypto. Staying with 100k iterations means if an attacker breaches the database in 2030, they have better hardware. We are betting that 100k will still be hard to crack in a few years. (Likely true, but not guaranteed.)

3. **Session token entropy.** `crypto.getRandomValues` is correct, but if anyone ever accidentally uses `Math.random`, the session tokens are guessable. A code review catch, but a human error waiting to happen.

4. **Session table growth.** After a year of light use, the sessions table might have 100k rows (one per unique recruiter per 30 days). Cleanup cron is needed. Forgotten cleanup = unbounded table growth = slow lookups. KV has no growth problem.

### Cross-examination

**Crypto liability:** Mitigated by (a) using only WebCrypto's built-in PBKDF2, no custom crypto, and (b) unit tests that verify the format and round-trip. The risk is real but not unique to A; Option C has the same risk if better-auth has a bug.

**PBKDF2 strength:** True for a long-running system, but the hackathon and immediate post-hackathon context is 2–6 months. By then, if a breach happens, we will have moved to bcrypt or Argon2 on a new library. Acceptable trade-off.

**Session token entropy:** Mitigated by not allowing any custom token generation outside the one function in `session.ts`. That function is unit-tested. Reduced risk.

**Table growth:** Real; cron cleanup is needed. One-line fix in the existing 03:00 cron that already purges raw sources. Not a blocker.

---

## Option B: Cloudflare Access / Zero Trust

### Advocate for B

1. **Zero auth code.** The app has no password handling, no session code, no PBKDF2. All attack surface is gone. Cloudflare's engineers maintain the auth layer.

2. **Automatic scaling.** Access is a platform service, managed by Cloudflare. No session table to grow, no cron to forget.

3. **Auditability.** Cloudflare logs every auth event. Recruiting teams have audit trails by default.

4. **SSO + SAML ready.** Post-hackathon, if multiple recruiters or enterprises want to log in, Access supports Okta, Entra, Google Workspace, SAML. No custom integration needed.

### Prosecutor B

1. **Does not fit the scope.** The brief says "self-serve signup". Access requires every recruiter to have an account with an identity provider (Okta, Entra, Google, GitHub). We cannot run a public signup; Access is only for known users. Contradicts "self-serve".

2. **Report pages become inaccessible.** `GET /runs/:id` (the report page) is a public UUID-only route in the hackathon. Behind Access, it requires login. Extension notification clicks (which have no session cookie) cannot open the report. We could whitelist report routes in Access, but that defeats the purpose of auth.

3. **Company lookup still custom.** ARES is still 200+ lines. Organization scoping is still needed. Company name in copy is still needed. Access eliminates zero lines of the hard work. We save maybe 100 lines of auth code but lose the self-serve narrative.

4. **Cost in the wrong place.** Access is free for 5 users. The demo will have 0 users for the first 7 hours of the hackathon. When we demo it, we will have 1–3 users (the team). Paying or managing identity providers for a 2-minute video is overhead.

### Cross-examination

**Scope mismatch is fatal.** The brief explicitly asks for self-serve signup. Access is designed for teams with existing identity providers. Using it would require explaining "we are demos on a pre-set account" to the jury, which is dishonest. Not recommended.

**Report page access:** Solvable by whitelisting UUIDs in Access, but that is configuration overhead and defeats the clean architecture. The real question: why use Access if we still need a custom auth layer for reports?

---

## Option C: Auth library (better-auth / Lucia) + D1 adapter

### Advocate for C

1. **Battle-tested boilerplate.** better-auth and Lucia handle email verification, password resets, session management, OAuth. We are not reinventing the wheel.

2. **Faster development.** Call `createUser`, `createSession`, get back hashed passwords and valid tokens. No custom token generation code to debug.

3. **Community maintenance.** If better-auth releases a security fix, we upgrade via npm. Custom code requires our own audits.

4. **Extensibility.** If post-hackathon we need magic links, email verification, or Passkeys, the library has it. We do not have to build it ourselves.

### Prosecutor C

1. **Lint debt.** better-auth uses `interface`, `default exports`, and other patterns that fail our strict ESLint config. We would need either (a) exceptions in eslint config (creates technical debt), or (b) forking the library and rewriting it (negates the time saving).

2. **Dependency risk.** better-auth pulls in @hono/node and other sub-dependencies. Bundling on Workers requires verification. One sub-dependency with a Workers incompatibility is a blocker. Option A is zero external deps.

3. **Overkill for the scope.** We need email + password + D1 hashing. The library brings email verification, OAuth providers, recovery codes, etc. We are paying for features we will not use and will have to configure away.

4. **Documentation burden.** Agents would need to read better-auth docs, understand adapters, set up D1 binding, and test. Option A's contracts are smaller and clearer.

5. **Vendor lock-in.** If better-auth's API changes or the maintainer abandons it, we are stuck maintaining a fork. Option A is portable.

### Cross-examination

**Lint debt:** This is the killer. The codebase has strict ESLint (no `warn`). better-auth will not comply. We would either need to compromise the config (bad precedent) or fight the library (not maintainable).

**Dependency risk:** Correct. Verification is extra work and extra risk.

**Overkill:** True. We are adding 1–3 dependencies for 150 lines of glue code that saves ~100 lines of custom code. The math is wrong.

**Agents and docs:** Clear win for Option A. Contracts are explicit.

---

## Summary

| Option | Should we pick it? | Why |
|---|---|---|
| **A (hand-rolled)** | **Yes** | Scope match, zero deps, proven pattern, agentic fit, testable. Risks are mitigated and small. |
| **B (Access)** | **No** | Scope mismatch (no self-serve). Saves wrong work (auth, not ARES). Report pages become gated. |
| **C (Auth library)** | **No** | Lint debt, overkill, vendor lock-in. Saves fewer lines than it adds in friction. |

**Recommendation:** Proceed with Option A.
