# Option A — Advocate

## Strongest case
1. Pre-mortem already picked this shape: Elephant #2 recommends "fixed plan per goal + LLM only for resolution scoring, synthesis, verify". A is that sentence as architecture (03-options A).
2. Only option that directly protects 20% e2e: T4 walking skeleton contract is built into a `for` loop over recipe. B's termination/cost are "emergent" (03-options B Test seams). T5/T8 become loop parameters in A, guardrails to build in B.
3. Goal switch is the product: Goal = question list + recipe (03-options A DDD); switching changes which steps run and which claims render; claim-level diff deterministic. Dynamic planner takes different path each run, harder to diff on stage.
4. Evidence says value is in verification, not planning: none of four OSS agents verify citations (02 §A); 3–13% hallucinated URLs (01). Fix = `{source_id, exact_quote}` + substring check + ledger-only URLs + second model residue. Pipeline stage; A makes it mandatory. Anthropic ended with separate CitationAgent (01).
5. Tooling fit: MCP `call-actor` returns status not output, no cost cap (01). `apify-client` has `maxTotalChargeUsd`, `usageTotalUsd`, timeout. One typed language end-to-end (01 Octoverse, arXiv 2602.17955).
6. Anthropic guidance: simplest pattern that passes evals; agents only when steps unknowable. Steps per goal are known. Multi-agent 15× tokens; $400 in 12 min (01).
7. Evolution cheap: `replan` step when coverage < threshold (03-options A Evolution) = pre-mortem "dynamic re-planning only if time at T+7h".

## Conceded + reframe
- Less agentic: true. B admits unpredictable spend. Jury accepts agentic if UI shows decisions (Elephant 2): stream lineup, per-step rationale, gaps.
- Originality 25%: real exposure, pack doesn't rebut. Originality from: citation verification by default, Sayari `possibly-same-as`, goal filtering claim graph. Jury perception [rhetoric].
- C cheaper: true; A's extra = route handler + streaming, buys live wow C lacks.
- New-subject failure = empty section: true (T1). Label PARTIAL; honesty rewards it.

## Verdict
Most likely to finish, stream live, verify every FACT by sunrise. Gives up architecture originality, wins it on verification, namesakes, goal-filtered claims.

---

# Option A — Prosecutor

## Strongest attacks
1. Recipe is "search and summarise" with extra steps: `for` loop, LLM at four seams (03-options A). T2 flags exactly this. Escape clause (Elephant 2) depends on UI theatre, not architecture. Nothing decides what recipe author didn't decide.
2. Goal switch cosmetic by construction: if both goals call same `serp, resolve, ares, website`, diff shows relabelled claims. "Add goals by adding a recipe file" admits goals differ only in config.
3. Recipes fail silently on empty sources: authwalled LinkedIn returns thin data (01, T1). Loop routes around; recipe has no "empty, try something else" branch. Gap stated honestly, value drops.
4. Namesake = single early step everything inherits: wrong merge (T3) poisons downstream, nothing reopens. Sayari `possibly-same-as` (02 §B) needs unresolved identities carried forward; linear shape makes that hard. Hidden coupling on `resolve` schema.
5. Long-running work in Next.js route handler: runs approach 2 min (T5); `.call()` blocks (01). [rhetoric] dev hot-reload kills in-flight run; client disconnect aborts; `GET /api/run/:id` exists but no worker, state lives in request lifecycle; no resume mechanism.
6. SQLite + route handler: `better-sqlite3` native addon. [rhetoric] bundling, runtime, dev-mode re-instantiation papercuts. T4 dominant failure. C avoids entirely.
7. Legibility overstated: ~10 step types, 4 seams, ports layer, DDD aggregates (03-options A). Muxin Li lost by Claude Code over-building infra (01). DDD ceremony invites exactly that. Three tracks → T4 contract drift.

## What must be true for A to be safe
- E1 passes; every step has empty-result branch that visibly changes plan (shown as decision in UI).
- Two demo goals differ in which steps run and which questions asked, not just filter.
- `resolve` can return `possibly-same-as` and pause for user.
- Run executes detached with ledger-resumable steps; UI streams from SQLite so restart doesn't kill demo.
- `replan` exists by T+7h.

## Verdict
Safest to finish, but jury sees configured pipeline: passes e2e, risks originality and "not search-and-summarise" unless at least one genuine runtime branching decision.
