# 00 — Synthesis: recruiter accounts, registration and onboarding

> **Recommendation: Option A, hand-rolled email + password with D1 cookie sessions and WebCrypto PBKDF2, company step by IČO through ARES with a manual fallback.** Zero new dependencies, every piece is a plain function testable with the existing fake-D1 pattern, and the bearer paths the extension and curl use stay untouched.
> Confidence: high for the build; medium for ARES reachability from a Workers egress IP (checked once from the deployed Worker; the manual path covers a failure).

## Context

oldboys has no users. The start form is anonymous (`POST /api/start` adds the shared `RUN_TOKEN` server-side), `/roles` asks the operator to paste `RUN_TOKEN`, and no run knows which recruiter or company asked for it. Robert asked (2026-10-08) for a classic SaaS self-serve flow for recruiters in the Czech market: email + password, **no email double opt-in**, the company filled from the registry by IČO, then a short onboarding that lands on the first brief. The brief's judging does not reward accounts, so the shape must stay small and must not delay the demo.

Decisions, taken 2026-10-08:
- A session is required for `/`, `/onboarding`, `/briefs`, `/roles` and `POST /api/start`. Anonymous browser runs end; every browser run carries `account_id` and `organization_id`. Bearer `POST /api/runs`, the call routes and the public `/runs/:id` pages are unchanged.
- No email channel exists, so no verification, no password reset. Rate limits in D1 replace verification as the spend brake (10 registrations per hour per IP, 5 failed logins per email per 15 minutes, 30 ARES lookups per hour per IP).
- Registering an existing email answers an honest 409 ("log in instead"); login stays generic and hashes a dummy password for unknown emails.
- ARES answers are cached 24 h in D1 because its terms forbid repeating identical queries; the IČO checksum runs before any network call; a foreign or unknown company is typed manually (`source = manual`, no IČO).
- Candidate notice and audit purpose name the organization when known ("the hiring team at X"), which makes the GDPR transparency text truthful.

Evidence: `01-deep-dive.md` (codebase facts, ARES fact sheet from live calls), `02-case-studies.md`, `03-options.md`, `04-steelman.md`. PM ritual: `docs/10-registration-brainstorm.md`, `docs/11-registration-discovery.md`, `docs/12-registration-pre-mortem.md`.

## Options considered

| Option | One-liner | Weighted score |
|---|---|---|
| A: Hand-rolled auth on D1 | PBKDF2 passwords, hashed session tokens in D1, cookie, handler.ts + fake D1 tests | 4.45 |
| B: Cloudflare Access in front | Zero auth code; identity from the Access JWT; company step still needs tables | 2.60 |
| C: Auth library + D1 adapter | better-auth / Lucia-style package with its own schema and routes | 3.05 |

## Decision matrix

| Criterion | Wt | A | B | C |
|---|---|---|---|---|
| Simplicity & operability | 20% | 5: five tables, three routes, no dependency (03 §A) | 2: dashboard-managed policy, breaks the public `/runs/:id` the extension opens (03 §B) | 3: adapter, schema and migrations owned by the library (03 §C) |
| Agentic-development fit | 20% | 5: every function greppable, strict-lint clean by construction (01 §codebase) | 3: behaviour lives outside the repo | 3: library APIs change often; hallucinated options under strict lint (02) |
| Domain fit (DDD) | 15% | 4: Accounts / Organizations / Sessions each one module (03 §A boundary map) | 2: no self-serve company aggregate | 3: library owns the user aggregate, org bolted on |
| Evolution & headroom | 15% | 4: add email verification or SSO later by adding columns and one route; exit = swap the password module (03 §A) | 2: self-serve registration impossible without leaving Access | 4: OAuth and verification come with the library |
| Testability (TDD) | 10% | 5: handler + fake D1, Node Vitest, no bindings (01 §tests) | 2: needs Access emulation | 3: library internals mocked |
| Delivery speed | 10% | 4: one night with parallel agents | 4: minutes for the gate, but the company step and scoping still need the same tables | 3: integration on OpenNext + Workers unknown |
| Cost | 5% | 5: zero | 4: free tier up to 50 users | 4: zero money, attention on upgrades |
| Risk & reversibility | 5% | 4: custom crypto discipline (mitigated by WebCrypto primitives and tests) | 3: lock-in to Access | 3: dependency chain on Workers |
| **Weighted total** | | **4.45** | **2.60** | **3.05** |

Sensitivity: doubling the weight of "Evolution" and halving "Simplicity" still leaves A ahead (4.25 vs 3.30 for C). B only wins if self-serve registration is dropped, which contradicts the ask.

## Winner's architecture

```mermaid
flowchart LR
  subgraph Browser
    R[/register, /login/] --> F[register-form, company-fields]
    O[/onboarding, /briefs, /roles/]
  end
  subgraph Worker["Cloudflare Worker (Next.js via OpenNext)"]
    AR[POST /api/auth/*] --> AS[auth-store.ts]
    AC[GET /api/ares/:ico] --> AH[ares handler + cache]
    ST[POST /api/start] --> RH[runs handler createRun]
    CU[currentUser()] --> AS
  end
  subgraph D1
    T1[(organizations)]
    T2[(accounts)]
    T3[(sessions)]
    T4[(auth_attempts)]
    T5[(ares_cache)]
    T6[(investigations + account_id, organization_id)]
  end
  F --> AR
  F --> AC
  O --> CU
  AS --> T1 & T2 & T3 & T4
  AH --> T5
  AH -. https .-> ARES[(ares.gov.cz)]
  RH --> T6
  EXT[Extension / curl, bearer] --> RB[POST /api/runs] --> RH
```

## Risk register (from A's prosecution in 04)

| Risk | Mitigation |
|---|---|
| ARES blocked or slow from Cloudflare egress | 20 s fetch timeout inherited from `fetchJson`, calm fallback copy, manual company path; checked once from the deployed Worker |
| No password reset | Accepted for the hackathon; the evolution path is an email channel (plan 008 intake gives the Worker outbound email later) |
| Custom crypto mistakes | Only WebCrypto primitives (PBKDF2, SHA-256, getRandomValues), constant-time compare, unit tests on format and round trip |
| Session table growth | Rows expire by `expires_at`; purge in the existing 03:00 cron is a one-line follow-up |
| Registration spam burning Apify budget | Per-IP cap, `START_PER_HOUR_CAP` stays, runs require a session |
| Login timing leak | Unknown email still runs `hashPassword` |
| `Set-Cookie` lost behind OpenNext | Verified in the preview smoke before merge |

## First implementation steps (test-first)

1. `src/domain/ico.ts` and `organization.ts` with tests (checksum, padding, ARES parse, manual input).
2. `password.ts` and `session.ts` with tests (round trip, format, cookie attributes).
3. `auth-store.ts` and the three auth handlers tested with the fake D1 (201/400/403/409/429, identical 401s, logout 204).
4. ARES handler with cache tests; `runs/handler.ts` with origin tests; `/api/start` requires the session.
5. Pages: register (two cards), login, onboarding, briefs; `/roles` loses the token prompt.
6. Preview smoke `scripts/auth-flow.mjs`, then `/simplify`, `/code-review --fix`, merge to main.

Flip `status: draft` → `active` in `README.md` when the decision is accepted.
