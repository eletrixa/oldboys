# 10 — Brainstorm: recruiter registration and onboarding

**Mode**: Ideas for existing product (oldboys web app, anonymous start form today)

**Context**: oldboys currently accepts any run via a shared bearer token. Robert wants self-serve signup for recruiters so that runs are scoped to an organization (via ARES company lookup by IČO), the candidate notice truthfully names the hiring team's employer, and the brief page shows only your company's runs. The flow is email + password, ARES autofill by IČO, then onboarding that lands on the first brief.

---

## PM Perspective (user value, business impact)

1. **Self-serve signup (email + password, no double opt-in)** — one form, create account and organization in one POST, land on onboarding. No email verification channel exists yet; rate limits replace it. | Impact: H | Effort: L
2. **Company lookup by IČO, ARES autofill** — type 8-digit IČO, get name, legal form, address, DIČ. Manual path if ARES is down or the company is foreign. | Impact: H | Effort: M
3. **Onboarding = first brief** — after signup, show "Your company is X" and the existing start form. Recruiter submits one LinkedIn URL and goes straight to the report. | Impact: H | Effort: L
4. **My briefs scoped by organization** — `/briefs` lists only runs created by accounts in your organization, not every run ever made. | Impact: H | Effort: M
5. **Organization name in candidate copy** — the candidate notice says "the hiring team at Acme" instead of "our hiring team" when an organization is set. Also audit purpose starts "Pre-employment screening by Acme for the role: …". | Impact: M | Effort: L

---

## Designer Perspective (UX, legibility, delight)

6. **One screen, two cards** — account card (email, password, name) then company card (IČO, lookup, company name, address). ARES fills while you type the 8th digit. | Impact: M | Effort: M
7. **Calm failure copy for ARES** — "We could not reach the registry. Please type your company name" shown if ARES times out or returns 404. Manual path is the primary fallback. | Impact: M | Effort: L
8. **Header shows company and Log out** — navigation bar carries "Signed in as Name at Company" plus a Log out button. Home page shows either a start form (logged in) or "Sign up / Log in" links (logged out). | Impact: M | Effort: L
9. **Privacy one-liner under the form** — "Public data only · no email verification · session cookie HttpOnly · password hashed". Reassures on what data goes where. | Impact: L | Effort: L
10. **Onboarding progress indicator** — after signup, show step 1 (company confirmed) and step 2 (start your first research). No modal, just the form and context. | Impact: L | Effort: L

---

## Engineer Perspective (technical leverage, reliability)

11. **PBKDF2 hashing via WebCrypto, no new dependency** — use globalThis.crypto.subtle for PBKDF2-SHA256 (100k iterations), base64 encode salt and hash. Matches Workers limits. | Impact: H | Effort: M
12. **D1 sessions with hashed tokens, no KV** — store `sessions` table with `token_hash` (SHA-256), not plaintext. No shared KV; D1 is fast enough for one indexed lookup per request. | Impact: H | Effort: L
13. **ARES lookup cached in `organizations` table** — cache ARES responses 24 hours in D1 (the API forbids repeating identical queries). One network call per unique IČO per day. | Impact: M | Effort: L
14. **IČO checksum validation in domain before any network call** — prevent invalid queries from hitting ARES. Return 400 early, no fetch. | Impact: M | Effort: L
15. **handler.ts pattern for auth routes** — test with the same fake D1 setup as the ElevenLabs webhook (`src/app/api/webhooks/__tests__/elevenlabs.test.ts`). No Next.js request mocking, all dispatch on SQL prefixes. | Impact: H | Effort: M

---

## Top 5 Recommendations

| Rank | Idea | Why | Quick win? |
|---|---|---|---|
| 1 | #2 + #12 + #14 IČO lookup, D1 sessions, checksum | Core promise: scoped runs. PBKDF2 and checksum validation are the tech risk; D1 is low-risk | Yes |
| 2 | #1 + #3 Self-serve, onboarding = first brief | Reduces friction: one form, lands straight into research; no onboarding tour | Yes |
| 3 | #6 + #7 + #9 Two-card design, calm ARES failure, privacy line | Users understand what's happening; manual path works if the registry times out | Yes |
| 4 | #5 + #8 Organization name in copy, header nav | Candidate-facing truth; recruiter sees their company context everywhere | Yes |
| 5 | #4 Briefs scoped by organization | Security and usability: no data leakage; list stays short and relevant | Follow-up |

---

## Deferred

- Email verification (no email service exists yet; rate limits and session TTL replace it for the demo).
- Password reset by email (same constraint).
- Invite colleagues by email.
- SSO / single sign-on.
- CAPTCHA / Turnstile on signup (rate limits on IP and email are sufficient).
- Two-factor authentication.

---

## Assumptions to validate

1. **Recruiters know their IČO or can find it in 10 seconds** — register page will link to ares.gov.cz name search.
2. **ARES answers from a Workers egress IP within 5 seconds** — needs a smoke call from the deployed Worker.
3. **Rate limits (10 reg/h per IP, 5 login fails per 15 min per email) are acceptable** — no email verification and no CAPTCHA mean abuse is possible; limits are the defense.
4. **PBKDF2 100k iterations completes within Workers' CPU time** — Cloudflare docs cap it at 100k; need to verify it runs in <300 ms in preview.
5. **Extension users do not need accounts** — bearer `POST /api/runs` stays untouched; extension e2e still passes without login.
6. **Organization name in candidate notice is wanted** — Robert reviews the copy before launch; GDPR transparency is the goal.
