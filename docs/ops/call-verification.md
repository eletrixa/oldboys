Operator-initiated phone calls to a consenting candidate via ElevenLabs Conversational AI + Twilio, asking a few points from a finished research run (role must-haves without evidence, "to verify" items, gaps). Answers are STATEMENT claims, never FACT; refusal or unconfirmed identity produces a gap, not a claim. This doc covers the UI, setup, secrets, the API workflow, and troubleshooting.

## Purpose and Rules

Call verification is optional per run; the backend accepts operator-entered, consented numbers only. The full number is used only in the approve handler and stored masked. The mapped call result (transcript) lands in R2 `oldboys-sources/<run>/src-call-<callId>.json` and is purged with the run.

**Hard rules:**
- Public data only; no GDPR Art. 9 inference or questions (health, politics, religion, ethnicity, sexuality). An operator question touching one is rejected with an error.
- Consent must be captured by the operator and noted in the call record.
- The first message discloses the AI, the purpose, the recording, that any question can be skipped, and asks for consent; the identity question comes before the questions.
- Refusal, no answer, or unconfirmed identity → stated gap, no claims.
- Answers are what the candidate said, not public evidence: they never change the brief or its coverage.
- Provider `mock` (default, canned transcript, labeled MOCK) or `elevenlabs` (requires setup below).

## What the UI Shows

On a finished brief (`/runs/<id>`), after "To verify", the card **Verify with the candidate by phone**:

1. Intro line; with `provider = mock` a MOCK badge "No real call. Answers are simulated."
2. Proposed questions (max 5): must-haves without public evidence, then with partial evidence, then "to verify" items, then gaps. Each is editable, has a grey chip with the reason (`why`) and a remove ×; "Add question" (up to 5) and "Reset to proposal".
3. "What the agent says first" (collapsed): the first message.
4. Form: phone number (E.164; spaces, dashes and a leading `00` are normalised), checkbox "The candidate agreed to this call and to the recording", how they agreed (required), your name (remembered in the tab). "Call candidate now" is enabled only when everything is valid and the run has calls left.
5. On click: draft with the edited questions, approve (dial), then poll every 3 s: "Calling +420*****123…", "Call finished, reading the answers…", "No answer", "The candidate declined the call", "Call failed: …". The team token (`RUN_TOKEN`) is asked once and kept in the tab, like on `/roles`.
6. Per question: Answered / Unclear / Declined / No answer / Not asked, STATEMENT tag, the summary, the quote with "at 1:23". Under it: "Said by the candidate on the phone. This is not public evidence and does not change the research coverage." Meta: duration, cost, identity confirmed, MOCK.
7. "1 of 2 calls used for this run"; earlier calls collapsed.

The interview kit (Copy / Download .md) gets a section "Phone verification (said by the candidate, not public evidence)" with the latest call's answers.

## Manual Setup (live calls)

Nothing here is done by code; do it once, in this order. Until step 11, everything keeps running on MOCK.

1. **Twilio number:** buy (or use the trial) number with Voice capability.
2. **Twilio Voice Geo Permissions:** enable **Czech Republic** (and any other country you dial) under Voice → Settings → Geo permissions.
3. **Twilio trial:** a trial account can only dial **verified caller IDs** (verify the demo phone under Phone Numbers → Verified Caller IDs) and plays a trial preamble before the agent speaks. Fine for a demo that calls a team member.
4. **ElevenLabs agent:** Agents → create an agent, language **English**. The system prompt and first message in the dashboard are placeholders: every call overrides them.
5. **Security overrides:** in the agent's Security tab, enable overrides for **System prompt**, **First message** and **Language** (otherwise the outbound call is rejected or ignores the brief).
6. **System tools:** enable **End call** and **Voicemail detection** (the prompt tells the agent to use `end_call` and to leave no voicemail).
7. **Data collection:** add `identity_confirmed`, type boolean, description "true only if the callee clearly confirmed they are the named candidate". ElevenLabs sends it as `{data_collection_id, value, rationale}`; the code reads `value`.
8. **Call config and privacy:** max duration **300 s**; audio storage off and the shortest transcript retention you can live with.
9. **Phone import:** Phone Numbers → import the Twilio number (SID + auth token or API key) and assign it to the agent; note the `phone_number_id`.
10. **Webhook:** workspace settings → Webhooks → POST `https://oldboys.asajj.cz/api/webhooks/elevenlabs`, auth **HMAC**, post-call **transcription** enabled (audio is ignored). Copy the secret.
11. **Secrets** (Robert): `pnpm exec wrangler secret put ELEVENLABS_API_KEY` and `pnpm exec wrangler secret put ELEVENLABS_WEBHOOK_SECRET`.
12. **Remote migration:** check that `migrations/0004_calls.sql` is applied remotely (`pnpm exec wrangler d1 migrations list oldboys --remote`); otherwise `pnpm db:migrate:remote`.
13. **Switch:** in `wrangler.jsonc` set `CALL_PROVIDER: "elevenlabs"`, `ELEVENLABS_AGENT_ID` and `ELEVENLABS_PHONE_NUMBER_ID`, update the cheat file (`docs/cli/cheat/oldboys.ps1`) in the same commit, deploy. Without the API key or either id the Worker silently stays on MOCK (`selectCallProvider`). **Fallback:** set `CALL_PROVIDER` back to `"mock"` and deploy.

## Secrets and Vars

**Wrangler secrets** (`wrangler secret put <name>`):
- `ELEVENLABS_API_KEY` — workspace API key
- `ELEVENLABS_WEBHOOK_SECRET` — from the webhook above
- `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `RUN_TOKEN` — existing

**Wrangler vars** in `wrangler.jsonc`:
- `ELEVENLABS_AGENT_ID` — agent id
- `ELEVENLABS_PHONE_NUMBER_ID` — imported number id
- `CALL_PROVIDER` — `"mock"` or `"elevenlabs"` (default `"mock"`)
- `RUN_CALL_MAX` — placed calls per run (default `"2"`)

**Local `.dev.vars`** (template `.dev.vars.example`, gitignored): the same secrets.

## API Workflow

The UI does exactly this; `scripts/call-smoke.mjs` does steps 1–3 without `questions`.

```bash
# Step 0: proposal, limit and earlier calls (no auth)
curl http://localhost:3141/api/runs/<run-id>/calls
# {provider, max, used, proposal: {questions, first_message, agent_prompt, ...}, calls: [...]}

# Step 1: draft the call; without "questions" the proposal is used
curl -X POST http://localhost:3141/api/runs/<run-id>/calls \
  -H "Authorization: Bearer $RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en","questions":[{"question_id":"mh-1","text":"Can you tell me about your Go work?"},{"text":"Why are you leaving Acme?"}]}'
# 201 {id, brief}; 400 {error, index} for an invalid or Art. 9 question

# Step 2: approve with consent (dials once)
curl -X POST http://localhost:3141/api/calls/<call-id>/approve \
  -H "Authorization: Bearer $RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_number":"+420777123456","consent_ack":true,"consent_note":"agreed by email on 8 Oct","operator":"minas"}'
# 202 {id, status:"dialing", provider} (mock: status is already terminal); 409 when RUN_CALL_MAX is reached

# Step 3: poll until terminal and answers !== null
curl http://localhost:3141/api/calls/<call-id>
# {id, status, provider, brief, ..., answers: null | [{question_id, question, status, summary, quote, at_secs}]}

# Skip a draft instead of dialing
curl -X POST http://localhost:3141/api/calls/<call-id>/skip -H "Authorization: Bearer $RUN_TOKEN"
```

Per-question answers are stored in the `call:finish` ledger row (`ref_json.answers`), so they need no migration and are deleted with the run.

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Panel shows MOCK although live is configured | `CALL_PROVIDER` not `"elevenlabs"`, or the API key / an id is empty | Check `wrangler.jsonc` and `wrangler secret list` |
| Approve returns 502 | ElevenLabs rejected the outbound call (overrides not enabled, number not imported, Twilio geo permission, trial number not verified) | Read `failure_reason` on the call; fix the matching setup step |
| Webhook returns 401 | HMAC secret mismatch | Verify `ELEVENLABS_WEBHOOK_SECRET` matches the workspace webhook |
| Webhook returns 500 "unknown conversation" | Webhook arrived before approve committed | Normal; ElevenLabs retries |
| "Reading the answers…" never ends | Workflow extract failed (e.g. Anthropic key) | The panel shows `last_error` once set; check the Workflow instance |
| Call stuck in `dialing` > 30 min | No webhook and polling failed 3 times | Check `last_error`; the Workflow polls 3 times then fails the call |
| All answers "Not asked" | Refused, not completed, or identity not confirmed | Expected; the gap reason is in the `call:finish` ledger row |

## Migration

The schema lives in `migrations/0004_calls.sql` (no further migration for phone verification). Apply to production before using live calls:

```bash
pnpm db:migrate:remote
```

## Live setup state (2026-10-09)

Production `CALL_PROVIDER` is now `"elevenlabs"` (`wrangler.jsonc`).

- **ElevenLabs agent** "oldboys verification call (hackathon)" (`ELEVENLABS_AGENT_ID=agent_5401m4etsexkfy5r4p1bam6zaqnz`): English, LLM `claude-sonnet-4-6`, TTS `eleven_flash_v2`, overrides enabled for prompt / first message / language, system tools `end_call` + `voicemail_detection`, data collection `identity_confirmed`, max call length 300s, `record_voice` off, `delete_audio` on, retention 7 days. Sentiment analysis is OFF — emotion inference is not allowed in hiring.
- **Phone number**: `ELEVENLABS_PHONE_NUMBER_ID=phnum_7601m4etsn2mfd2rwgfky2bwmjfw` is a Twilio Verified Caller ID (outbound only). The Twilio account has the Czech low-risk Geo permission on; buying a dedicated number is blocked until Twilio Trust Hub KYC is approved.
- **Webhook**: HMAC workspace webhook `3d42b5a6c31544f5b7f7adc4bc1808a0` → `https://oldboys.asajj.cz/api/webhooks/elevenlabs`, event `transcript` only. `call_initiation_failure` is not enabled yet, so busy/no-answer is detected by the Workflow poll fallback after 30 minutes.
- **Secrets**: `ELEVENLABS_API_KEY` and `ELEVENLABS_WEBHOOK_SECRET` are set by Robert via `wrangler secret put`. Until the webhook secret is set, the webhook route answers 503 and ElevenLabs retries.
- **Rollback**: set `CALL_PROVIDER` back to `"mock"` in `wrangler.jsonc`.
