# 11 — Discovery: recruiter registration and onboarding

**Date**: 2026-10-08

**Product Stage**: existing product (web app with anonymous flow), new self-serve accounts surface

**Discovery Question**: Will a self-serve signup flow with ARES company lookup unlock recruiter scoping and organization-aware copy, and can the team build it in time without breaking the extension or the core research runner?

---

## Ideas carried forward

From `docs/10-registration-brainstorm.md`:

| Idea | Rationale |
|---|---|
| A. Self-serve signup (email + password, no email verify) | Simple, fast; rate limits replace email verification |
| B. ARES IČO lookup with manual fallback | Automated company data for CZ; manual path for foreign or outage |
| C. D1 sessions with PBKDF2 hashing | No new dependency; testable; Workers-compatible |
| D. Onboarding = first brief start form | Reduces friction; go straight to research |
| E. Organization name in copy and header | Candidacy truth; recruiter context |

---

## Critical assumptions

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| 1 | Recruiters know their IČO or find it in 10 seconds | Usability | H | M | Proceed; register page links to ares.gov.cz |
| 2 | ARES responds within 5 seconds from Workers IPs | Feasibility | H | M | Validate once in deployed Worker; manual path is fallback |
| 3 | Rate limits (10/h IP, 5 fails/15min email) suffice without email verify | Viability | M | L | Noted in pre-mortem as acceptable for demo |
| 4 | PBKDF2 100k iterations runs in <300 ms on Workers | Feasibility | H | L | Unit test; measure in preview |
| 5 | Extension users do not need accounts | Value | M | L | Bearer path untouched; extension e2e confirms |
| 6 | Organization name in copy is wanted by Robert | Value | M | L | Robert reviews; GDPR Art. 5(a) transparency |

Leap-of-faith: 2 (ARES egress-IP acceptance), 3 (rate limits sufficient).

---

## Validation checks (the loop)

| Check # | Tests | Method | Success criteria | When |
|---|---|---|---|---|
| C1 | Register with email + password + IČO | Smoke against `pnpm preview` | Account, organization, session created in one POST; redirected to `/onboarding` | After first all-green gate |
| C2 | ARES lookup from Worker | Call `GET /api/ares/27074358` from deployed oldboys.asajj.cz | Response `{company}` with name; second call uses cache (no new fetch) | After deploy |
| C3 | PBKDF2 timing | Unit test + measure in `pnpm preview` register flow | Hash/verify cycle under 300 ms | Before CI |
| C4 | Login + logout + session expiry | Login with wrong password 5x, 6th gets 429; logout clears cookie; revisiting `/briefs` without session → redirected to `/login` | All transitions work; no data leakage | C1 pass |
| C5 | Unknown/foreign company | Type company name without IČO and register; onboarding shows "Your company is [typed name]" | Manual path works when IČO is absent or ARES is unavailable | C1 pass |
| C6 | Extension unchanged | `pnpm --filter oldboys-extension e2e` | Bearer `POST /api/runs` works; open `/runs/:id` by UUID without session | After migration |

---

## Decision framework

**If C2 fails (ARES unreachable from Workers):** Use manual company name path as primary; ARES becomes "try autofill if you have an IČO". Register flow unchanged, lookup route returns 502 and shows calm copy.

**If C3 fails (timing >300 ms):** Reject PBKDF2; escalate to Robert for a second choice (Argon2 not available in WebCrypto). Unlikely given the 100k cap.

**If C4 fails (session cookie not set):** Verify `Set-Cookie` header passes through OpenNext `proxy.ts` (should work; no `runtime = "edge"`). Test on preview before deploy.

**If C5 fails (manual path breaks form):** Make IČO optional in the schema; `source` field tracks whether it came from ARES or manual entry.

**If C6 fails (extension e2e breaks):** Revert `/api/runs` changes to be strictly backward-compatible; the `account_id` field addition should not change the existing bearer request handling.

---

## Timeline within the loop

```
repeat
  spawn agents (WP-A..F) with contracts → wait
  pnpm check; wrangler deploy --dry-run
  pnpm db:migrate:local && pnpm preview → Playwright smoke (scripts/auth-flow.mjs)
  run checks C1–C6; audit against the 11 success criteria
until all green
```

Each iteration, new agent tasks are written for failing checks. Target: two iterations.

---

## Next steps

Pre-mortem: `docs/12-registration-pre-mortem.md`. Architecture dossier: `plans/009-recruiter-accounts/`.
