---
plan: 009-recruiter-accounts
status: draft
owner: Robert
created: 2026-10-08
type: feature
---

# Recruiter accounts — planning folder

**Goal:** Prepare the backend and frontend so recruiters can self-serve: email + password signup, ARES company lookup by IČO, account and organization creation in one POST, then onboarding that lands on the first research brief.

**Status:** Draft — dossier in progress. PM docs (brainstorm, discovery, pre-mortem) are `docs/10..12`. Architecture dossier below. Build contracts in `00-SYNTHESIS.md`.

**Trigger:** Robert's request 2026-10-08: self-serve accounts so runs are scoped to an organization and the candidate notice truthfully names the hiring team.

---

## Read order

| # | Doc | What it does |
|---|-----|--------------|
| **00** | [SYNTHESIS](./00-SYNTHESIS.md) | Decision summary: contracts, options, recommended path, TDD order |
| 01 | [Deep dive](./01-deep-dive.md) | Codebase facts + ARES API fact sheet |
| 02 | [Case studies](./02-case-studies.md) | Hand-rolled sessions on Workers, PBKDF2, OpenNext cookies, ARES API terms |
| 03 | [Options](./03-options.md) | Candidates A (hand-rolled), B (Cloudflare Access), C (auth library), with container diagrams |
| 04 | [Steelman](./04-steelman.md) | Advocate vs Prosecutor per option, cross-examination |

---

## Out of scope

- Email verification (no email service configured; rate limits replace it for the demo).
- Password reset by email.
- Invite colleagues by email.
- SSO / single sign-on.
- Two-factor authentication.
- CAPTCHA / Turnstile (rate limits on IP and email suffice).

---

## Cross-references

| Path | What |
|---|---|
| `docs/10-registration-brainstorm.md` | PM ideas: self-serve, ARES, D1 sessions |
| `docs/11-registration-discovery.md` | Assumptions and validation checks |
| `docs/12-registration-pre-mortem.md` | Risk register and Go/No-Go checklist |
| `src/domain/ico.ts` | IČO normalization and checksum |
| `src/domain/organization.ts` | ARES schema and organization input |
| `src/domain/password.ts` | PBKDF2 hashing and verification |
| `src/domain/session.ts` | Session token and cookie handling |
| `src/app/api/auth/` | Register, login, logout routes |
| `src/app/api/ares/[ico]/` | ARES lookup and caching |
| `migrations/0010_accounts.sql` | Accounts, organizations, sessions, auth_attempts, ARES cache |
| `src/app/(auth)/` | Register, login, onboarding pages |
