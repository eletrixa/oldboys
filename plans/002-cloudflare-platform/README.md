---
plan: cloudflare-platform
status: active
owner: Robert
created: 2026-10-08
type: decision
supersedes-part-of: 001-deep-research-arch (store, runner hosting, streaming transport)
---

# 002 — Platform: run the 001 architecture on Cloudflare

001 chose "Recipe with ledger-first discipline" and scoped deployment to localhost. This plan keeps every 001 domain decision (recipe, four LLM seams, claim model, verify, lineup pause, onEmpty) and replaces the three pieces that assumed a single Node process with disk:

| 001 assumed | Why it breaks on Workers | 002 choice |
|---|---|---|
| Runner = detached promise in Next.js route | Worker invocations are request-scoped, no background process | **Cloudflare Workflow** `ResearchRun`: one `step.do` per recipe step, `step.waitForEvent('lineup-answer')` for the namesake pause, retries + durability for free |
| `runs/<id>/ledger.jsonl` + `claims.json` on disk | No filesystem | **D1** tables `ledger_entries` (append-only, `seq`), `claims`, `gaps`, `candidates`; `claims.json` becomes a projection query |
| `sources/*.json` raw actor payloads | No filesystem | **R2** `oldboys-sources/<run>/<source>.json` (deleted after judging per brief) |
| SSE tails the ledger file | Same | SSE route handler polls D1 `seq > last` every 1 s, emits AI SDK data parts; replays the whole ledger on connect |
| `next build && next start` on stage | n/a | `opennextjs-cloudflare` on Workers; demo from the deployed URL, `wrangler dev` as fallback |

See `00-SYNTHESIS.md` for the diagram, bindings, and the risks this adds.
