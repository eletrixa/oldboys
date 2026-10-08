# 05 — Pre-mortem

Scenario: it is the end of the hackathon and the call verification feature failed. Why?

## Tigers

### Launch-blocking

| # | Tiger | Mitigation | Owner | Deadline |
|---|---|---|---|---|
| 1 | Webhook never reaches the Worker in the demo (URL misconfigured, HMAC secret mismatch) | E-C3 fixture test, Workflow poll fallback, `GET /api/calls/:id` shows `last_error` | Backend | Before E-C1 |
| 2 | Organisers rule the call out of bounds | A1 asked at T+0; MOCK path is identical from the UI's point of view; report labels the source as a consented phone call or MOCK | Robert | T+1h |
| 3 | Transcript quote fails the quote-in-excerpt rule because the extractor paraphrases | Extraction schema requires `quote` copied verbatim; deterministic check downgrades to INFERENCE | Backend | Stage 1 step 4 |

### Fast-follow

| # | Tiger | Mitigation |
|---|---|---|
| 4 | Call cost unit in the webhook is unclear (credits versus cents, UNCONFIRMED) | Record raw `metadata.cost` and `cost_fiat` from the GET conversation endpoint; flag, never drop, a call over `CALL_BUDGET_USD` |
| 5 | Czech unsupported or poor (UNCONFIRMED) | Brief carries `language`, default `en` until A5 passes |

### Track

| # | Tiger | Why it is only tracked |
|---|---|---|
| 6 | 30-minute webhook retry storm after a 5xx | Idempotency table covers duplicates; retries stop after 5 attempts |
| 7 | Workflow timeout while the callee is still talking | `max_duration_seconds` default 600 is below the 30-minute wait |
| 8 | `(run_id, seq)` collision from two Workflows | `appendLedger` retries once; watch for constraint errors |

## Paper Tigers

- **Twilio number provisioning.** A dashboard job of about 15 minutes; the mock path covers the demo regardless.
- **ElevenLabs SDK on Workers.** The SDK is not used; plain `fetch` with `xi-api-key`.
- **Webhook before `waitForEvent`.** Looks scary, but the Workflow reads D1 before waiting, so ordering does not matter.

## Elephants

- **The demo callee is a team member.** Judges may read it as staged. Say so in the video and show the MOCK label logic.
- **GDPR.** The callee's voice is personal data. Purge R2 payloads with the rest of the raw data after judging, store the number masked, announce recording and purpose in the opener, never ask for sensitive data. General knowledge, verify with counsel (see 06).
- **"Drafted, never sent" in the brief.** Robert resolved it with operator-approved numbers and recorded consent. If organisers disagree, only the live provider is lost.

## Go / No-Go checklist

Go for the live path only if all of these hold:

- [ ] A1 answered by the organisers (or Robert accepts the risk in writing).
- [ ] `pnpm check` green on stage 1 and S1 to S6 hold.
- [ ] Migration `0003_calls.sql` applied remotely by Robert before the webhook route deploys.
- [ ] `ELEVENLABS_WEBHOOK_SECRET`, `ELEVENLABS_API_KEY`, agent id and phone number id set; overrides enabled on the agent for prompt, first message and language.
- [ ] E-C3 passes, then E-C1 passes with a volunteer callee who consented.
- [ ] Opener contains AI disclosure, purpose and recording consent; hang up on refusal.
- [ ] MOCK label visible in source actor and ledger ref for the mock path.

No-Go (demo on MOCK, labeled): any unchecked item above at T+8:30. Stage 1 alone is still honest and demoable.
