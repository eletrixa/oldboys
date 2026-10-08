# 02 — Discovery

## Assumptions

| # | Assumption | Category | Impact | Uncertainty | Test |
|---|---|---|---|---|---|
| A1 | Operator-consented calls are inside the brief's rules | Viability | High | Medium | Ask organisers in the first hour; fallback is a MOCK-only demo |
| A2 | ElevenLabs outbound call and webhook work from Workers with plain `fetch` (no SDK) | Feasibility | High | Medium | E-C1 smoke script |
| A3 | Webhook delivers within 30 min and HMAC verifies as documented (`t=...,v0=...`) | Feasibility | High | Medium | E-C1 plus unit test with a recorded header |
| A4 | A transcript quote can satisfy the FACT-style rule (quote inside excerpt) | Value | High | Low | Unit test on a fixture transcript |
| A5 | Czech works for the agent | Usability | Medium | High | One test call; fallback English |
| A6 | A 2-minute call costs under $0.50 | Viability | Low | Low | Pricing page: $0.08/min plus Twilio |
| A7 | Other devs can build the UI on the contract without touching the Workflow | Feasibility | High | Low | Contract doc 06 plus `curl` examples |

## Impact x Risk classification

| | Low uncertainty | Medium uncertainty | High uncertainty |
|---|---|---|---|
| **High impact** | A4, A7: verify with tests, proceed | **A1, A2, A3: leap of faith, test first** | |
| **Medium impact** | | | A5: one test call, fallback English |
| **Low impact** | A6: check pricing page | | |

Leap of faith: A1, A2, A3.

## Experiments

| ID | What | Success criteria | Failure action |
|---|---|---|---|
| **E-C1** | Live smoke. `scripts/call-smoke.mjs` places a call to a team member's number, receives the webhook (tunnel or deployed Worker), polls `GET /api/calls/:id` | A `calls` row reaches `done`; transcript stored in R2; at least one STATEMENT claim or a stated gap reason appears in the ledger; cost recorded | Demo on MOCK, labeled, if E-C1 fails by T+8:30 |
| **E-C2** | Mock end-to-end in Vitest: brief, mock provider, fake webhook, claims appended | Run fixture with 2 gaps gives a brief with identity question plus 2 questions; 2 STATEMENT claims (never FACT); downgrade to INFERENCE where the quote mismatches; MOCK label in source actor and ledger ref | Fix code, never the test |
| **E-C3** | Signature fixture test | Header computed independently in the test verifies; tampered body, stale timestamp and malformed header are rejected | Fix code; do not loosen the window |

## Decision framework

1. Ask A1 at T+0. A "no" removes the live provider and keeps everything else (MOCK labeled).
2. Stage 1 (brief, table, mock, Workflow, routes) must be green by T+7h. It is honest and demoable alone.
3. Stage 2 (live provider, signed webhook) starts only when stage 1 is green. E-C3 runs before E-C1 so a signature bug is not mistaken for a network bug.
4. If E-C1 fails by T+8:30, ship stage 1 and demo on MOCK. The report labels the source, so nothing is overstated.
5. A5 is decided by one test call. Until it passes, `language` in the brief defaults to `en`.
