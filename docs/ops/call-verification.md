Operator-initiated phone calls to a consenting candidate via ElevenLabs Conversational AI + Twilio, asking a few points from a finished research run (role must-haves without evidence, "to verify" items, gaps). Answers are STATEMENT claims, never FACT; refusal or unconfirmed identity produces a gap, not a claim. This doc covers the UI, setup, secrets, the API workflow, and troubleshooting.

## Purpose and Rules

Call verification is optional per run; the backend accepts operator-entered, consented numbers only. The full number is used only in the approve handler and stored masked. The mapped call result (transcript) lands in R2 `oldboys-sources/<run>/src-call-<callId>.json` and is purged with the run.

**Hard rules:**
- Public data only; no GDPR Art. 9 inference or questions (health, politics, religion, ethnicity, sexuality). An operator question touching one is rejected with an error.
- Consent must be captured by the operator and noted in the call record.
- The first message is short (at most 220 characters, about 9 s of speech) and discloses the AI, who it calls for and why (hiring, the role), the recording, and asks for consent: "Hi, this is an AI assistant calling for the hiring team about the <role> role. This call is recorded. Do you have three minutes for a few questions?" Right after the callee agrees, the agent says "You can skip any question or stop at any time." and then asks the identity question, before the questions.
- Refusal, no answer, or unconfirmed identity → stated gap, no claims.
- Answers are what the candidate said, not public evidence: they never change the brief or its coverage.
- Provider `mock` (default, canned transcript, labeled MOCK) or `elevenlabs` (requires setup below).

## What the UI Shows

On a finished brief (`/runs/<id>`), in the **Phone screen** tab (`#call`), the card **Verify with the candidate by phone**:

1. Intro line; with `provider = mock` a MOCK badge "No real call. Answers are simulated."
2. Proposed questions (max 5). When the setup opens, the panel asks `POST /api/runs/<id>/calls/proposal` once for an **AI draft** ("Drafting questions from the research…"): Opus 5.5 (`LLM_MODEL_PRIMARY`) writes 3–5 specific, open questions anchored on the confirmed research ("Your GitHub has a repo with Airflow DAGs from 2023 – which part did you build yourself, and what was the hardest problem?"), labelled **AI-drafted, edit before the call**. Under each question: "Follow-up if the answer is vague: …" and "Listen for (not read aloud): …" (read-only; they stay when the text is edited). The model sees only confirmed research: must-haves with coverage and summary, to-verify items (CV differences included), weak or contradicted claim texts, profile risks / history / position-fit gaps / questions and plain "no … found" gaps; never the personality read, unconfirmed (`also_found`) hits, evidence quotes, URLs, e-mails or tool notes. In code after the model: one line, length caps, Art. 9 and off-limits topics (salary, family, age, other candidates, personality) dropped, dedupe, at most 5. The draft is cached in R2 (`call-questions/<run>.json`, keyed by a hash of the research input and prompt version, deleted with the run); one `llm` ledger row `call:questions` per model call; no new draft once the run's drafts would pass `CALL_BUDGET_USD`. If the model fails, times out, returns nothing usable, there is no AI key or the user is not logged in, the panel silently shows the rule-based proposal with a small note. GET `/api/runs/<id>/calls` never calls the model; it returns the cached draft as `ai_proposal`. Rule-based proposal (fallback): must-haves without public evidence, then with partial evidence, then "to verify" items, then gaps. They are worded as plain spoken questions to the candidate ("Can you tell me about your prior cleaning experience?", "Do you have Go backend experience?", "We read that you led a team of five at Acme. Is that right?"); the missing evidence is not read out, it is in the grey chip with the reason (`why`). Each is editable and has a remove ×; "Add question" (up to 5) and "Reset to proposal".
3. "What the agent says first" (collapsed): the first message.
4. Form: phone number (E.164; spaces, dashes and a leading `00` are normalised), checkbox "The candidate agreed to this call and to the recording", how they agreed (required), your name (remembered in the tab, cleared on logout). "Call candidate now" is enabled only when everything is valid and the run has calls left.
5. On click: draft with the edited questions, approve (dial), then poll every 3 s for up to 35 minutes (then "No result after 35 minutes. Reload the page later."): "Calling +420******123…", "Call finished, reading the answers…", "No answer", "The candidate declined the call", "Call failed: …". The panel uses the operator's login session (no team token); if the session has expired it shows "Your login has expired. Log in again." with a link to `/login`. Scripts and curl send `Authorization: Bearer $RUN_TOKEN` instead.
6. Per question: Answered / Unclear / Declined / No answer / Not asked, STATEMENT tag, the summary, the quote with "at 1:23". Under it: "Said by the candidate on the phone. This is not public evidence and does not change the research coverage." Meta: duration, cost, identity confirmed, MOCK.
7. "1 of 2 calls used for this run"; earlier calls collapsed. After a finished call the answers come first and the form folds under "Call again · N of M calls left". Only calls that are in progress or reached the person count (`dialing`, `done`, `refused`); a call that never connected (`failed`, `no_answer`: provider rejected it, busy, no answer) does not use a slot.

With the report switched to CZ the tab ("Telefonický screening"), labels and status lines are Czech, but the call stays English (questions, first message, answers and quotes; a note says so). The interview kit ("Copy interview kit", or "Download .md" under "More exports") gets a section "Phone verification (said by the candidate, not public evidence)" with the latest call's answers.

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
10. **Webhook:** workspace settings → Webhooks → POST `https://oldboys.asajj.cz/api/webhooks/elevenlabs`, auth **HMAC**, post-call **transcription** and **call initiation failure** enabled (audio is ignored; an initiation failure marks the call "No answer" for busy / no answer, else "Call failed", at once instead of after the 30-minute poll). Copy the secret.
11. **Secrets** (Robert): `pnpm exec wrangler secret put ELEVENLABS_API_KEY` and `pnpm exec wrangler secret put ELEVENLABS_WEBHOOK_SECRET`.
12. **Remote migration:** check that `migrations/0004_calls.sql` is applied remotely (`pnpm exec wrangler d1 migrations list oldboys --remote`); otherwise `pnpm db:migrate:remote`.
13. **Switch:** in `wrangler.jsonc` set `CALL_PROVIDER: "elevenlabs"`, `ELEVENLABS_AGENT_ID` and `ELEVENLABS_PHONE_NUMBER_ID`, update the cheat file (`docs/cli/cheat/oldboys.ps1`) in the same commit, deploy. Without the API key or either id the Worker silently stays on MOCK (`selectCallProvider`). **Fallback:** set `CALL_PROVIDER` back to `"mock"` and deploy.

## Secrets and Vars

**Wrangler secrets** (`wrangler secret put <name>`):
- `ELEVENLABS_API_KEY` — workspace API key (also used by `POST /api/runs/:id/speech`: "Read aloud" on the 30-second card, text to speech in the agent's voice `cjVigY5qzO86Huf0OWal`, `eleven_flash_v2_5`; if you change the agent's voice, change `SPEECH_VOICE_ID` in `src/app/api/runs/[id]/speech/handler.ts` too)
- `ELEVENLABS_WEBHOOK_SECRET` — from the webhook above
- `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `RUN_TOKEN` — existing

**Wrangler vars** in `wrangler.jsonc`:
- `ELEVENLABS_AGENT_ID` — agent id
- `ELEVENLABS_PHONE_NUMBER_ID` — imported number id
- `CALL_PROVIDER` — `"mock"` or `"elevenlabs"` (default `"mock"`)
- `RUN_CALL_MAX` — calls per run that are in progress or reached the person (status `dialing`, `done` or `refused`; default `"2"`). Failed and unanswered calls do not count.
- `CALL_BUDGET_USD` — USD cap on the AI question drafts of one run (default `"0.50"`); once the run's `call:questions` rows plus about $0.15 would pass it, no new draft is made and the panel shows the rule-based questions

**Local `.dev.vars`** (template `.dev.vars.example`, gitignored): the same secrets.

## API Workflow

The UI does this, plus one `POST /api/runs/<run-id>/calls/proposal` (session or bearer; 200 `{source: "ai"|"rules", cached, note, proposal}`, a fallback is still 200) when step 0 has no `ai_proposal`, and it skips a draft whose approve answered 400 or 409; `scripts/call-smoke.mjs` does steps 1–3 without `questions`.

```bash
# Step 0: proposal, limit and earlier calls (no auth)
curl http://localhost:3141/api/runs/<run-id>/calls
# {provider, max, used, proposal: {questions, first_message, agent_prompt, ...}, ai_proposal: null | {...}, calls: [...]}

# Step 1: draft the call; without "questions" the proposal is used
curl -X POST http://localhost:3141/api/runs/<run-id>/calls \
  -H "Authorization: Bearer $RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en","questions":[{"question_id":"mh-1","text":"Can you tell me about your Go work?"},{"text":"Why are you leaving Acme?"}]}'
# 201 {id, brief}; 400 {error, index} for an invalid or Art. 9 question; 409 while the run has not started yet

# Step 2: approve with consent (dials once)
curl -X POST http://localhost:3141/api/calls/<call-id>/approve \
  -H "Authorization: Bearer $RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_number":"+420777123456","consent_ack":true,"consent_note":"agreed by email on 8 Oct","operator":"minas"}'
# 202 {id, status:"dialing", provider} (mock: status is already terminal); 409 when the call is not drafted or RUN_CALL_MAX is reached; 502 when the provider rejected the call; 500 {error, id} when the call was placed but the result Workflow did not start

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
| Approve returns 500 "call placed but the result workflow could not start" | The call was dialed but creating the VERIFY_CALL Workflow failed | `last_error` starts with "workflow not started:"; nothing reads the answers, check the Workflow binding and redeploy |
| All answers "Not asked" | Refused, not completed, or identity not confirmed | Expected; the gap reason is in the `call:finish` ledger row |

## Migration

The schema lives in `migrations/0004_calls.sql` (no further migration for phone verification). Apply to production before using live calls:

```bash
pnpm db:migrate:remote
```

## Live setup state (2026-10-09)

Production `CALL_PROVIDER` is now `"elevenlabs"` (`wrangler.jsonc`).

- **ElevenLabs agent** (in-call model unchanged by the AI-drafted questions: it stays `claude-sonnet-4-6`; only the questions, follow-ups and listen-for notes in the per-call prompt override are drafted by Opus 5.5) "oldboys verification call (hackathon)" (`ELEVENLABS_AGENT_ID=agent_5401m4etsexkfy5r4p1bam6zaqnz`): English, LLM `claude-sonnet-4-6`, TTS `eleven_flash_v2`, overrides enabled for prompt / first message / language, system tools `end_call` + `voicemail_detection`, data collection `identity_confirmed`, max call length 300s, `record_voice` off, `delete_audio` on, retention 7 days. Sentiment analysis is OFF — emotion inference is not allowed in hiring.
- **Phone number**: `ELEVENLABS_PHONE_NUMBER_ID=phnum_7601m4eyf5tbf3svv7pwpvggw3v5` is a Twilio US number, +1 443 316 2585, bought after the Twilio Trust Hub individual profile was approved on 2026-10-09. The earlier verified caller ID +420 775 498 771 (`phnum_7601m4etsn2mfd2rwgfky2bwmjfw`) is kept in ElevenLabs but not used: calls via Twilio that present a Czech caller ID are rejected by Czech carriers as spoofed (Twilio reports "busy", 0s).
- **Webhook**: HMAC workspace webhook `3d42b5a6c31544f5b7f7adc4bc1808a0` → `https://oldboys.asajj.cz/api/webhooks/elevenlabs`, events `transcript` and `call_initiation_failure`. The agent's post-call webhook now also sends `call_initiation_failure`, so busy / no answer reaches the app at once instead of waiting on the 30-minute Workflow poll fallback.
- **Secrets**: `ELEVENLABS_API_KEY` and `ELEVENLABS_WEBHOOK_SECRET` are set by Robert via `wrangler secret put`. Until the webhook secret is set, the webhook route answers 503 and ElevenLabs retries.
- **Call limit**: `RUN_CALL_MAX` is 5. Since 2026-10-09 only `dialing`, `done` and `refused` calls count (`COUNTED_CALL_STATUSES` in `src/domain/call.ts`); calls that failed before connecting no longer use a slot.
- **Rollback**: set `CALL_PROVIDER` back to `"mock"` in `wrangler.jsonc`.
- **Delete on rejection or request** (`POST /api/runs/:id/delete`, "Delete candidate data" on the run page): deletes the call rows, the R2 call results and the webhook events with the rest of the run and terminates the call Workflows; a live call that is still dialing (no result, approved less than 40 minutes ago) makes it answer 409 until the call ends. Nothing is deleted at ElevenLabs or Twilio: ElevenLabs keeps the transcript for up to 7 days under the agent's retention setting (audio is not stored), and the audit record says so for runs with a live call.
