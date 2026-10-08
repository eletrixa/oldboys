# 02 — Pre-mortem

Imagine it is 2026-10-12 and intake failed. Why?

## Tigers (real, mitigated)
| Failure | Mitigation |
|---|---|
| Spoofed mail to `jobs+<tag>@` burns runs ($0.50 each) | Known tag required; `INTAKE_FROM_ALLOW` sender list for email; `INTAKE_PER_HOUR_CAP` (10) on `via='intake'` plus the global 20/h; capped rows kept for manual start |
| Bots hit `/apply/<tag>` | Same-origin + Sec-Fetch-Site check, honeypot, 5 MB PDF only, hourly cap; Turnstile ready as the next step |
| Jobs.cz / LinkedIn notification carries a CV link, not an attachment | Status `incomplete` with the note; fixture captured from a real application, parser extended (link follow only for allow-listed hosts) |
| StartupJobs deletes the webhook on a 5xx | Handler never answers 5xx: validation → 422, unexpected throw → 202 after logging; row stays `received` and visible |
| Gmail forwarding confirmation never seen | Every inbound mail is forwarded to `INTAKE_FORWARD_TO` once verified; until then the code is in the Worker log (`wrangler tail`) |
| Scanned PDF, no text | `incomplete` with note "no extractable text"; LinkedIn URL in the mail body still starts the run |
| Duplicate deliveries (Gmail + Seznam both forward, StartupJobs retries) | `(source, external_id)` unique; email id = Message-ID, StartupJobs id = offer:candidate, apply page id = hash(tag,email) |

## Paper tigers
- "Email Routing will break existing mail on asajj.cz": there is no MX record today.
- "OpenNext cannot export `email`": `src/worker.ts` is already a custom worker with `scheduled`.
- "Workers cannot parse PDF": `unpdf` runs on Workers and Node.

## Elephants
- Nobody has posted a job on Jobs.cz or LinkedIn yet; the first real notification shape is unknown until a test application is sent. The loop closes only after that step (owner: Robert, posting costs money).
- `intake_tags` duplicates part of plans/007 `positions`; agreed to merge later with `tag` as the key.

## Go / No-go
Go. The email door alone, with the apply page, covers every board on the list without partner approvals or paid ATS; each unit has a contract and a test list; the spend brake is deterministic and in the runner, not the LLM.
