Operator-initiated phone calls to consenting callees via ElevenLabs Conversational AI, asking the open questions (gaps) from a finished research run. Calls are branded STATEMENT claims, never FACT; refusal or unconfirmed identity produces a gap, not a claim. This doc covers setup, secrets, the operator workflow, and troubleshooting.

## Purpose and Rules

Call verification is optional per-run; the backend enforces operator-entered, consented numbers only. The full number is used only in the approve handler and stored masked. Raw payloads land in R2 `oldboys-sources/<run>/call-<callId>.json` and are purged after judging.

**Hard rules:**
- Public data only; no GDPR Art. 9 inference (health, politics, religion, ethnicity, sexuality).
- Consent must be captured by the operator and noted in the call record.
- Brief opens with an AI disclosure, a recording-consent line, and an identity question.
- Refusal, no answer, or unconfirmed identity → stated gap, no claims.
- Provider `mock` (default, canned transcript, labeled MOCK) or `elevenlabs` (requires setup below).

## ElevenLabs Setup Checklist

1. **Create agent:** Log into [ElevenLabs workspace](https://elevenlabs.io/), go to **Agents**, create a new agent.
2. **Security overrides:** In **Settings > Security**, enable overrides for prompt, first message, and language.
3. **Phone import:** Import a Twilio number. Note the `agent_phone_number_id` from the import.
4. **Webhook:** In workspace settings, go to **Webhooks**, create a POST endpoint pointing to `https://oldboys.asajj.cz/api/webhooks/elevenlabs`, select **HMAC** for auth, and copy the secret to `ELEVENLABS_WEBHOOK_SECRET`.
5. **Data collection:** Add a custom data-collection field named `identity_confirmed` (boolean type).
6. **Call config:** Set `max_duration_seconds` to 300.

## Secrets and Vars

**Wrangler secrets** (run `wrangler secret put <name>`):
- `ELEVENLABS_API_KEY` — Workspace API key from [Profile > API Keys](https://elevenlabs.io/account/api-keys)
- `ELEVENLABS_WEBHOOK_SECRET` — From webhook creation above
- `ANTHROPIC_API_KEY` — Existing
- `APIFY_TOKEN` — Existing
- `RUN_TOKEN` — Existing bearer token

**Wrangler vars** in `wrangler.jsonc`:
- `ELEVENLABS_AGENT_ID` — Workspace agent UUID
- `ELEVENLABS_PHONE_NUMBER_ID` — From step 3
- `CALL_PROVIDER` — `"mock"` or `"elevenlabs"` (default: `"mock"`)

**Local `.dev.vars`** (copy from `.dev.vars.example`, add to .gitignore):
```
ELEVENLABS_API_KEY=<key>
ELEVENLABS_WEBHOOK_SECRET=<secret>
ANTHROPIC_API_KEY=<key>
APIFY_TOKEN=<token>
RUN_TOKEN=<bearer-token>
```

## Operator Workflow

Prerequisite: a finished research run with ID `<run-id>` and gaps to verify.

```bash
# Step 1: Create call (drafts it with the brief questions)
curl -X POST http://localhost:3141/api/runs/<run-id>/calls \
  -H "Authorization: Bearer $RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}' \
  # Response: {id, brief}

# Step 2: Show brief to callee, obtain consent, approve
curl -X POST http://localhost:3141/api/calls/<call-id>/approve \
  -H "Authorization: Bearer $RUN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to_number":"+420777123456",
    "consent_ack":true,
    "consent_note":"callee agreed by SMS 2026-10-08",
    "operator":"robert"
  }' \
  # Response: 202 {id, status:"dialing", provider} (mock: status is already terminal)

# Step 3: Poll call status (repeats every 5 s until terminal)
curl http://localhost:3141/api/calls/<call-id> \
  # Returns {id, run_id, status, provider, brief, ...}
  # Status: drafted, dialing, done, failed, no_answer, refused, skipped

# Step 4: Skip if needed
curl -X POST http://localhost:3141/api/calls/<call-id>/skip \
  -H "Authorization: Bearer $RUN_TOKEN"
```

## What the UI Shows

- **Status machine:** drafted → dialing → done | failed | no_answer | refused; drafted → skipped
- **MOCK label:** appears on calls when `CALL_PROVIDER=mock` (demos)
- **STATEMENT label:** appears on claims extracted from call transcripts
- **Cost:** final `cost_usd` populated after the call ends
- **Identity:** unconfirmed identity blocks claim generation

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Webhook returns 401 | HMAC secret mismatch | Verify `ELEVENLABS_WEBHOOK_SECRET` matches ElevenLabs workspace settings |
| Webhook returns 500 "unknown conversation" | Webhook arrived before approve committed | Normal; ElevenLabs retries for 30 min |
| Call stuck in `dialing` > 30 min | Workflow polling failed 3 times | Check `last_error` field; Workflow polls conversation 3 times then fails |
| Status never updates after dialing | Poll endpoint not polling | Ensure GET /api/calls/<id> is running; updates appear every 5 s |
| Use `CALL_PROVIDER=mock` for demos | ElevenLabs not configured or testing | Set `wrangler.jsonc` var, or run offline with canned transcript |

## Migration

The schema lives in `migrations/0004_calls.sql`. Apply to production before deploying the webhook route:

```bash
pnpm db:migrate:remote
```

Robert must run this before deploying the oldboys.asajj.cz worker.
