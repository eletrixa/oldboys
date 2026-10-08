# 12 — Pre-Mortem: recruiter registration and onboarding

**Date**: 2026-10-08

**Status**: Draft

**Scenario**: It is sunrise. The recruiter signup feature is supposed to be live. Either it broke, took the night from the core product, or the jury found a gap. Why?

---

## Risk summary

- **Tigers**: 6 (3 launch-blocking, 2 fast-follow, 1 track)
- **Paper Tigers**: 3
- **Elephants**: 2

---

## Launch-blocking Tigers

| # | Risk | Likelihood | Impact | Mitigation | Owner | Deadline |
|---|---|---|---|---|---|---|
| T1 | **ARES blocked from Cloudflare IPs.** The registry rejects batch queries or geo-blocks all Worker egress. Signup stalls, manual path is the only option, users see "Registry unavailable" repeatedly. | M | H | Deploy a test call from the live Worker to ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/27074358 at T+6h. If it succeeds, cache it. Manual path always works; the message says "Try typing your company name instead". 5-second timeout, then fallback copy. | Robert | T+6h |
| T2 | **PBKDF2 exceeds Workers CPU time.** Hash takes 1+ second per registration, timing out on slow networks. Users see a 504, registration fails silently. | M | H | Unit test on hashing (round-trip hash/verify under 100 ms each). Measure in `pnpm preview` register flow. If exceeded, escalate to Robert; Argon2 not available, may need a different KDF or accept it as a demo limitation. | Build agent | T+3h |
| T3 | **Cookie not set behind OpenNext.** The `Set-Cookie` response header is stripped by the proxy. Session lookup fails, user stays logged out even after register. | M | H | Test `pnpm preview` register flow: check browser DevTools for `oldboys_session` cookie after POST `/api/auth/register`. If missing, verify OpenNext pass-through (no `runtime = "edge"` in route handlers). Fallback: if cookie handling is broken, pivot to Bearer token in `Authorization` header and store in `localStorage` (less secure, accept as a demo-only measure). | Build agent | T+3h |

---

## Fast-follow Tigers

| # | Risk | Likelihood | Impact | Planned response | Owner |
|---|---|---|---|---|---|
| T4 | **IČO checksum rejects valid companies.** The validation is too strict; users type their IČO correctly but get "invalid IČO". Example: 27074358 gets rejected due to a bug in the checksum logic. | M | M | Unit test all three valid IČOs (27074358, 00006947, 25596641) and three invalid (12345678, 00000000, 99999999). The checksum must not flip false negatives and false positives. If it does, fix and add a comment explaining the formula. | Build agent | T+3h |
| T5 | **ARES response shape diverges from the spec.** The ARES API returns fields with different names or missing fields. `textovaAdresa` is missing, schema validation fails, address is NULL. | M | M | Real ARES call in E1 spike (from `wrangler dev`). Compare response to the spec in the plan. If divergent, update `AresSubjekt` Zod schema and document any UNCONFIRMED fields. | Build agent | T+2h |

---

## Track Tigers

| # | Risk | Likelihood | Planned response |
|---|---|---|---|
| T6 | **Rate-limit bypass via stolen session token.** A shared token stored in localStorage leaks; attacker registers unlimited accounts. | L | Sessions are short-lived (30 days); compromised token is a concern for any web app, not unique to this flow. Mitigation: HttpOnly cookie + SameSite=Lax + Secure (https only in prod). Attacker cannot steal token via XSS if it is HttpOnly. Post-hackathon: add IP pinning to sessions. |

---

## Paper Tigers

- **"Signup is too complex; recruiters will not fill out two cards."** The two-card design is a mockup assumption. Validation: show a wireframe to 2–3 recruiters during T+4h and measure time-to-completion. If >2 min, simplify. Likely outcome: "IČO field confuses me" → add a link to ares.gov.cz name search.
- **"We need email verification to prevent spam."** No email service is configured. The demo accepts the risk. Rate limits (10 signups per hour per IP) and session-based scoping (cannot act without a session) bound the damage. The brief says "no fake accounts"; this is a self-enforcing rule.
- **"D1 is too slow for session lookups."** One indexed lookup per request. Latency is <10 ms on a quiet database. If the session table grows to 100k rows (unlikely in a demo), measure again. KV is an evolution path.

---

## Elephants in the room

1. **The shared RUN_TOKEN stays.** New accounts do not retire the bearer token; both paths coexist. A recruiter could still paste the token into `/roles` and create runs with `account_id = NULL`. This is acceptable: the brief says "outreach drafted and shown, never sent", and the UI is honest about it. GDPR is honored because org-scoped runs still say the truth when an org is known. Conversation: "Is coexistence a feature or a liability?" Suggested: feature for now (extension still uses bearer); post-hackathon, sunset bearer.

2. **Identity: who confirmed the email really belongs to the recruiter?** The brief says "no fake accounts". This flow has no email verification. A user can sign up with any email. For a hackathon demo, acceptable. Post-hackathon: add magic links or TOTP. For now, if "robert@fake-company.cz" signs up, it is Robert's problem if he cannot access his account (he cannot reset the password without email).

---

## Go/No-Go checklist (success criteria mirror)

Criterion 1: `pnpm check` green, Worker bundles → automated gate.

Criterion 2: Register → `/onboarding` → session created → integration test or smoke passes.

Criterion 3: Unknown/foreign company → manual path works → integration test.

Criterion 4: Login/logout, rate limits, 429 on 6th fail → unit tests.

Criterion 5: Onboarding form + run created with org ids → integration test.

Criterion 6: `/briefs` scoped by org → query test.

Criterion 7: Org name in copy → candidate-copy unit test + smoke.

Criterion 8: Bearer `/api/runs`, extension e2e green → extension smoke.

Criterion 9: PBKDF2 hashed, session hash, cookie attrs, no leak → unit tests.

Criterion 10: Headers on files, domain tests, migration noted, cheat updated, llm-manual-runs row → code review.

Criterion 11: Playwright smoke pass (register → onboarding → brief → logout → login) → scripts/auth-flow.mjs.

**Gate rule**: All 11 must be green before merge to main. If any fail, write a new agent task and re-run the loop.

---

## Next steps

Architecture dossier: `plans/009-recruiter-accounts/`. Build contracts and agents: `plans/009-recruiter-accounts/00-SYNTHESIS.md`.
