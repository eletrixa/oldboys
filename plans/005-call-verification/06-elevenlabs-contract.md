# 06 — ElevenLabs contract and backend routes

Facts from research on 2026-10-08. Anything tagged **UNCONFIRMED** was not verified against the vendor and must be tested in E-C1 before the UI relies on it. Verify legal points with counsel.

## Outbound call request and response

Twilio outbound: `POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call`, header `xi-api-key`.
Docs: https://elevenlabs.io/docs/api-reference/twilio/outbound-call

Required: `agent_id`, `agent_phone_number_id`, `to_number`.
Optional: `conversation_initiation_client_data`, `call_recording_enabled`, `telephony_call_config`.

`conversation_initiation_client_data` fields: `conversation_config_override` (`asr`, `turn`, `tts`, `conversation`, `agent`), `dynamic_variables` (string to any), `custom_llm_extra_body`, `user_id`, `source_info`, `branch_id`, `environment`, `starting_workflow_node_id`, `procedure_ids`.

Request body the backend sends:

```json
{
  "agent_id": "<ELEVENLABS_AGENT_ID>",
  "agent_phone_number_id": "<ELEVENLABS_PHONE_NUMBER_ID>",
  "to_number": "+420...",
  "conversation_initiation_client_data": {
    "dynamic_variables": { "subject": "...", "questions": "..." },
    "conversation_config_override": {
      "agent": { "prompt": "...", "first_message": "...", "language": "en" }
    }
  }
}
```

Response 200 (ids may be null):

```json
{ "success": true, "message": "...", "conversation_id": "...", "callSid": "..." }
```

- The exact key for prompt text in the override (string `prompt` versus nested `prompt.prompt`) is **UNCONFIRMED**. Test in E-C1.
- No idempotency key is listed for the request. Treat a dial as non-idempotent; this is why the dial lives in the route handler (see 04). **UNCONFIRMED** that none exists.
- SIP trunk alternative: `POST /v1/convai/sip-trunk/outbound-call`, same params, response has `sip_call_id`. `telephony_call_config` covers ringing timeout, recording and answering-machine detection; regional servers EU, India, Singapore. https://elevenlabs.io/docs/api-reference/sip-trunk/outbound-call
- Batch calling (not used): `POST` with `call_name`, `agent_id`, `recipients`, optional `scheduled_time_unix`, `timezone`, `agent_phone_number_id`, `telephony_call_config`, `target_concurrency_limit`. Concurrency is min(50% workspace, 70% agent). Zero Retention Mode is incompatible. Shape of `recipients[]` is **UNCONFIRMED**. https://elevenlabs.io/docs/api-reference/batch-calling/create and https://elevenlabs.io/docs/agents-platform/phone-numbers/batch-calls
- Phone numbers: imported from Twilio (label, number, SID, token; an API key SK... is recommended) or SIP trunk. Verified caller IDs are outbound-only. Direct purchase is **UNCONFIRMED**. Import endpoint `POST /v1/convai/phone-numbers` is **UNCONFIRMED**. https://elevenlabs.io/docs/agents-platform/phone-numbers/twilio-integration/native-integration

## Agent setup, per-call overrides and dynamic variables

- Create agent: `POST https://api.elevenlabs.io/v1/convai/agents/create` returns `agent_id`. Body has `conversation_config` (prompt and LLM, `first_message`, language, TTS, ASR/turn/VAD) and `platform_settings` (evaluation, data collection, overrides, webhooks, duration limits, privacy). https://elevenlabs.io/docs/api-reference/agents/create
- Per-call overrides are off by default. Enable per field under `platform_settings.overrides.conversation_config_override`. Override shape `{"agent":{"prompt":"...","first_message":"...","language":"cs"}}`. Also overridable: `tool_ids`, `knowledge_base`, `llm`, `voice_id`, `stability`, `speed`, `similarity_boost`, `asr.keywords`. https://elevenlabs.io/docs/agents-platform/customization/personalization/overrides
- Dynamic variables: `{{var}}` in prompt, first message and tool params. Reserved: `system__conversation_id`, `system__called_number`, `system__call_sid`, `system__caller_id`, `system__call_duration_secs`, `system__time_utc`, `system__conversation_history`. Behaviour of an undefined variable is **UNCONFIRMED**; always pass every variable the prompt uses. https://elevenlabs.io/docs/agents-platform/customization/personalization/dynamic-variables
- Data collection: items with `identifier`, `type` (string, boolean, integer, number) and `description`. Missing values are null. Limit 25 per agent (40 trial/enterprise). Field names `platform_settings.data_collection` and `platform_settings.evaluation.criteria` are **UNCONFIRMED**. https://elevenlabs.io/docs/agents-platform/customization/agent-analysis/data-collection
- Server tools: `{"type":"webhook","name","description","api_schema":{url,method,path_params_schema,query_params_schema,body_params_schema}}`, attached via `conversation_config.agent.prompt.tool_ids`. https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools Client tools and system tools (`end_call`, voicemail detection) are **UNCONFIRMED**.
- Limits: `max_duration_seconds` default 600 (60 to 7200), `turn_timeout` 1 to 30 s. https://elevenlabs.io/docs/agents-platform/customization/conversation-flow

## Post-call webhook events and payload

Docs: https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks

| Event | Content |
|---|---|
| `post_call_transcription` | transcript, metadata, analysis |
| `post_call_audio` | `agent_id`, `conversation_id`, `full_audio` base64 MP3, chunked, 5-minute timeout |
| `call_initiation_failure` | `agent_id`, `conversation_id`, `failure_reason` (`busy`, `no-answer`, `unknown`), Twilio/SIP metadata |

Example `post_call_transcription` payload:

```json
{
  "type": "post_call_transcription",
  "event_timestamp": 1739537297,
  "data": {
    "agent_id": "...",
    "conversation_id": "...",
    "status": "done",
    "user_id": "...",
    "transcript": [
      {
        "role": "agent",
        "message": "...",
        "tool_calls": null,
        "tool_results": null,
        "feedback": null,
        "time_in_call_secs": 0,
        "conversation_turn_metrics": null
      }
    ],
    "metadata": {
      "start_time_unix_secs": 1739537297,
      "call_duration_secs": 22,
      "cost": 296
    },
    "analysis": {
      "evaluation_criteria_results": {},
      "data_collection_results": {},
      "call_successful": "success",
      "transcript_summary": "..."
    }
  }
}
```

- Unit of `metadata.cost` is **UNCONFIRMED** (credits versus cents). Store the raw value; take USD from `cost_fiat` on the GET endpoint.
- Shape of entries in `evaluation_criteria_results` and `data_collection_results` is **UNCONFIRMED** (believed `{result, rationale, value}`).
- The backend ingests only `post_call_transcription` and `call_initiation_failure`. `post_call_audio` is acknowledged and ignored (no audio retention).

## Signature verification

Header `ElevenLabs-Signature: t=<unix>,v0=<hex>`. HMAC-SHA256 over `"{timestamp}.{rawBody}"` with the webhook secret, 30-minute tolerance. The secret is generated when the webhook is created. Optional static egress IP allowlist.
Sources: https://raw.githubusercontent.com/elevenlabs/elevenlabs-js/main/src/wrapper/webhooks.ts and https://elevenlabs.io/docs/eleven-api/resources/webhooks.md

- Verify on the raw body text before any JSON parse. Constant-time compare. 401 on failure.
- The SDK helper name is **UNCONFIRMED**; the backend implements the check itself with WebCrypto in `src/domain/elevenlabs-signature.ts`.

## Retries

Only `post_call_transcription` retries. Up to 5 attempts at immediate, 30 s, 2 min, 8 min, 30 min, plus up to 10% jitter. Retried on 5xx, 429, 408, connection errors and timeouts. 4xx is not retried. Success is HTTP 200. The webhook is auto-disabled after 10 consecutive failures with no success in 7 days. https://elevenlabs.io/docs/eleven-api/resources/webhooks.md

Consequences for the backend: return 500 (not 404 or 200) for an unknown `conversation_id` so the early webhook is redelivered; return 200 with no side effect for a duplicate `(conversation_id, type)`; `call_initiation_failure` does not retry, so the Workflow poll fallback must cover a lost one.

Configuration: create the webhook (HMAC) in workspace settings and enable post-call webhooks; agent-level overrides apply. The list API shows auth types `hmac`, `oauth2`, `mtls`. https://elevenlabs.io/docs/api-reference/webhooks/list The create endpoint is **UNCONFIRMED**.

## GET conversation fallback

`GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}` returns `status` (`initiated`, `in-progress`, `processing`, `done`, `failed`), `transcript`, `analysis`, `metadata` (`call_duration_secs`, `cost_fiat` in USD, `start_time_unix_secs`, phone details) and `has_audio` flags. Not final until `status` is `done`. https://elevenlabs.io/docs/api-reference/conversations/get

The audio endpoint `GET /v1/convai/conversations/{id}/audio` is **UNCONFIRMED** and unused.

## Limits and pricing

https://elevenlabs.io/pricing/agents

| Item | Value |
|---|---|
| Per minute | $0.08 on all tiers; $0.16 burst over concurrency; $0.003 per text message |
| Included minutes | Creator 275, Pro 1,238, Business 12,375 |
| Concurrency | Creator 10, Pro 20, Business 40 |
| Telephony | no ElevenLabs telephony fee; Twilio charged separately (rates **UNCONFIRMED**); LLM usage passed through |

Other limits: latency is unpublished; IVR behaviour is **UNCONFIRMED**; Czech support is **UNCONFIRMED** (help-centre article returned 403, https://help.elevenlabs.io/hc/en-us/articles/29298127196945). Default language is `en` until E-C1 proves Czech.

SDK `@elevenlabs/elevenlabs-js` v2.71.0 (deps `ws`, `node-fetch`, `command-exists`, Node 18 or newer): Workers compatibility is **UNCONFIRMED** (reports of node built-in failures) and method names are **UNCONFIRMED**. Decision: plain `fetch` with the `xi-api-key` header. https://github.com/elevenlabs/elevenlabs-js

## Legal and consent script requirements

General knowledge, not legal advice. Verify with counsel.

- No ElevenLabs-specific outbound disclosure policy page was found (**UNCONFIRMED**).
- EU AI Act Art. 50: disclose that the callee is talking to an AI system.
- Czech Republic: no flat two-party recording rule. Announce recording and purpose. GDPR Art. 6(1)(f) legitimate-interest balancing, a retention limit, and an Art. 14 notice apply.
- Zákon č. 127/2005 Sb. limits unsolicited marketing calls. A verification call to a business line is not marketing; keep the script non-promotional.
- Opener: "I'm an automated AI assistant calling on behalf of X to verify one fact. This call may be recorded. Do you agree?" As built (2026-10-09, shortened after live calls where callees talked over an 18 s opener): "Hi, this is an AI assistant calling for the hiring team about the <role> role. This call is recorded. Do you have three minutes for a few questions?" (at most 220 characters); "You can skip any question or stop at any time." follows right after the callee agrees.
- Hang up on refusal. Never ask for sensitive data (GDPR Art. 9 categories are denylisted in `buildCallBrief`).
- The brief always asks an identity-confirmation question first.

## What the UI developers call

All routes except the webhook are served by the Worker. Routes marked "session or bearer" accept a logged-in `oldboys_session` cookie (the web UI) or `Authorization: Bearer <RUN_TOKEN>` (scripts, curl); without either they answer `401`, and a bearer is answered `503` while `RUN_TOKEN` is unset. `POST /api/runs` stays bearer-only. Numbers are E.164. The full number is used once, in the approve handler, and is never returned by any route.

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/runs/:id/calls` | none | Proposal (computed, not stored), provider, call limit and usage, the run's calls with answers |
| `POST /api/runs/:id/calls` | session or bearer | Build a brief from the stored brief, gaps and weak claims, or from operator-edited questions; create a `drafted` call |
| `POST /api/calls/:id/approve` | session or bearer | Record consent, dial once, start the Workflow |
| `POST /api/calls/:id/skip` | session or bearer | Mark `skipped`; writes a `decision` ledger row, existing gaps stay stated |
| `GET /api/calls/:id` | none | Status, brief, result summary, `last_error`, per-question `answers` |
| `POST /api/webhooks/elevenlabs` | HMAC signature | Called by ElevenLabs only, never by the UI |

### `GET /api/runs/:id/calls`

No auth (same as `/state`). `404` unknown run. Response `200`:

```json
{
  "provider": "mock|elevenlabs",
  "max": 2,
  "used": 1,
  "proposal": { "language": "en", "identity_question": "...", "questions": [], "script": "...", "first_message": "...", "agent_prompt": "..." },
  "calls": [{ "id": "...", "status": "done", "answers": [] }]
}
```

`proposal` is what `POST` without `questions` would draft now; it is never stored. `used` counts calls in status `dialing`, `done` or `refused` (in progress or reached the person; the same rule as the approve guard, `countsTowardCallLimit` / `COUNTED_CALL_SQL` in `src/domain/call.ts`); `failed` and `no_answer` calls never connected and do not count. `calls` are all non-skipped calls of the run, newest first, each in the `GET /api/calls/:id` shape.

### `POST /api/runs/:id/calls`

Request (session or bearer): optional body `{"language": "en", "questions": [{"question_id": "mh-1", "text": "...", "why": "..."}]}` (`language` 2 to 5 chars, default `en`; `questions` optional). `404` unknown run, `409` while the run is still `queued`. Response `201`:

```json
{
  "id": "0f3c...-uuid",
  "brief": {
    "language": "en",
    "identity_question": "Am I speaking with Jane Doe?",
    "questions": [{ "question_id": "mh-1", "text": "Do you have Go backend experience?", "expected": "", "why": "No public evidence: Go backend" }],
    "script": "I am an automated AI assistant calling on behalf of ...\nThis call may be recorded and transcribed. Do you agree to continue?\n...",
    "first_message": "Hi, this is an AI assistant calling for the hiring team about the Senior Go engineer role. This call is recorded. Do you have three minutes for a few questions?",
    "agent_prompt": "# Role\n...\n# Steps\n...\n# Questions\n1. ...\n# Rules\n..."
  }
}
```

Without `questions` the brief is deterministic (no LLM): identity question first, then at most 5 of, in order, role must-haves (`mh-*`) with coverage `none`, with coverage `partial`, the brief's `to_verify` items (`tv-<n>`), one question per gap, one verification question per claim with confidence under 0.6 or a contradiction; never a GDPR Art. 9 topic. Without a stored brief it is gaps then weak claims, as before. Wording (`src/domain/call-wording.ts`, deterministic): a must-have stored as a third-person question becomes second person ("Does the candidate have …?" → "Do you have …?"), otherwise "Can you tell me about your <title>?" (`none`) or "Can you tell me a bit more about your <title>?" (`partial`); a `to_verify` item becomes "We read that <first clause, the candidate's name as you/your>. Is that right?", or the whole text plus "Is that right?" when it cannot be cut cleanly. The missing evidence is only in `why`, never read out.

With `questions` (the operator edited the proposal): 1 to 5 questions, each 5 to 300 characters after trimming; a question touching an Art. 9 topic, or any invalid one, is `400 {"error": "...", "index": <n|null>}` (never a silent drop). Proposed ids (`mh-…`, `tv-…`) are kept, new questions get `hr-1`, `hr-2`, ….

`first_message` (AI disclosure, who for and why, recording, consent question; at most 220 characters) and `agent_prompt` (role, steps with the skip/stop sentence right after consent, questions in order, rules: no evaluation, no decision/salary/other candidates, no personal topics, voicemail, `end_call`) go to ElevenLabs as the per-call overrides `agent.first_message` and `agent.prompt.prompt`. Both are optional in the schema: calls drafted before they existed fall back to the script and its first line.

### `POST /api/calls/:id/approve`

Request (session or bearer):

```json
{ "to_number": "+420123456789", "consent_ack": true, "consent_note": "volunteer, agreed verbally", "operator": "robert" }
```

Responses: `202 {"id","status":"dialing","provider":"elevenlabs"}` (with the mock provider the result is immediate and `status` is already `done`); `400` invalid body or number not E.164; `401` no session and no or a wrong bearer; `404` unknown call; `409` call not `drafted` or the run already has `RUN_CALL_MAX` (2) calls in status `dialing`, `done` or `refused` (failed or unanswered calls do not count); `502` provider rejected the call (row goes to `failed` with the reason, no Workflow is created).

### `POST /api/calls/:id/skip`

Request (session or bearer), no body. Response `200 {"id","status":"skipped"}`; `409` if the call is no longer `drafted`. Gaps are left as they are (still stated in the report); a `decision` ledger row records the skip.

### `GET /api/calls/:id`

No auth (same as the SSE events route). `404` unknown call. Response `200`:

```json
{
  "id": "0f3c...-uuid",
  "run_id": "...",
  "status": "drafted|dialing|done|failed|no_answer|refused|skipped",
  "provider": "elevenlabs|mock",
  "brief": { "language": "en", "identity_question": "...", "questions": [], "script": "..." },
  "to_number_masked": "+420******456",
  "provider_conversation_id": null,
  "call_successful": null,
  "identity_confirmed": null,
  "duration_secs": null,
  "cost_usd": 0,
  "failure_reason": null,
  "last_error": null,
  "created_at": "2026-10-08T18:00:00.000Z",
  "approved_at": null,
  "finished_at": null,
  "answers": null
}
```

`answers` is `null` until the Workflow wrote its `call:finish` ledger row, then one entry per brief question (`[]` for calls finished before the field existed):

```json
{ "question_id": "mh-1", "question": "...", "why": "No public evidence: Go backend", "status": "answered|unclear|declined|no_answer|not_asked", "summary": "Uses Go daily.", "quote": "I used it every day", "at_secs": 83 }
```

`answered` = a STATEMENT claim (verbatim quote in a callee line, `at_secs` = time of that line); `unclear` = an INFERENCE (no quote); `declined` = the extractor listed it in `declined_question_ids`; `not_asked` for every question when the call was refused, not completed or identity was not confirmed. Answers live only in the ledger ref (no column, no migration) and never change the brief or its coverage.

No raw number and no transcript body. Progress also appears as `call` and `decision` rows on `GET /api/runs/:id/events` (SSE). A source labeled "Phone call (AI interviewer)" or MOCK appears when the call completes.

Status machine: `drafted -> dialing -> done | failed | no_answer | refused`; `drafted -> skipped`. Claims from a call are `STATEMENT` (quote must be a verbatim callee line), never `FACT`; the transcript Source is `<run>/src-call-<callId>.json` in R2 with actor `elevenlabs/convai` or `mock/convai`.

### `POST /api/webhooks/elevenlabs` (ElevenLabs only)

- Read the raw body, verify `ElevenLabs-Signature`; `401` on failure.
- `500` if `conversation_id` is unknown (provider retries); `200` with no side effect if `(conversation_id, type)` was already stored; `200` after persisting the result and signalling the Workflow.
- Configure it in ElevenLabs with the deployed Worker URL and the HMAC secret stored as `ELEVENLABS_WEBHOOK_SECRET`.
