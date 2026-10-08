# Option B — Advocate

## Strongest case
1. Originality structurally higher: pre-mortem concedes dynamic planner "cooler", fixed pipeline agentic only if UI shows decisions (Elephant 2). B makes decisions real; tool-call history is the plan (03-options B). A's own evolution is "becomes B gradually".
2. T2 addressed at root: goal question list drives tool choice; hiring vs due diligence call different actors; claim-level diff shows real divergence.
3. MCP breadth: 30k actors selectable via `?tools=` (01). Recipe hard-codes six; agent reaches for different one when LinkedIn empty (T1 H/H). Falls back to SERP/website/ARES at runtime instead of empty step.
4. Realtime sells "user understands how report built": claims/tool_calls/ledger stream over WS; first claim <20 s via row inserts (T5). Anthropic: full tracing = debuggability fix (01); tool_calls table is that trace free.
5. Gaps first-class: `mark_gap` tool; fits OSINT survey triage-then-verify (01).
6. Verification architecture shared: claim graph, Wikidata rank, `possibly-same-as`, excerpt-in-ledger check identical across options. B pays nothing extra on honesty; final verify call = separate CitationAgent design.
7. Tooling first-class: `stopWhen: stepCountIs(n)` + `onStepEnd` give hard step bound + telemetry (01).

## Conceded + reframe
- MCP 45 s + no output (01): wrap call/get-run/get-items in one local `run_actor` tool, ~30 lines. 45 s matches T5 timeout.
- No MCP cost cap (ASSUMPTION): budget in loop (≤12 runs, T8), URL dedupe, log `usageTotalUsd`. Hybrid: direct `apify-client` for 4–5 known actors with `maxTotalChargeUsd`.
- Termination: `stepCountIs`, call budget, repeat-call rejection, coverage checklist (01).
- 15× tokens: real; cap bounds it. $400 anecdote single-source.
- Supabase + OAuth: real cost; use bearer token, one project, four tables.
- Unproven sizing: pre-mortem says dynamic only if time at T+7h; can't refute. Reframe: recipe-seeded system prompt, let agent deviate.

## Verdict
Wins originality and real goal-driven divergence if loop bounded (step cap, call budget, repeat rejection, hybrid tool layer); riskiest build; loses e2e if walking skeleton not running by T+2h.

---

# Option B — Prosecutor

## Strongest attacks
1. MCP leg weakest link, pack says so: `call-actor` 45 s, returns status not output (01:19). One lookup = three model-mediated turns, each a chance to stop early, poll forever, invent result. Pack verdict: "adds a hop and poll loop you'd write anyway, loses cost cap".
2. No hard cost cap: MCP `maxTotalChargeUsd` ASSUMPTION (01:20); native client has it. B cost line "unpredictable LLM spend". T8 is B's default failure. Loop-enforced cap only counts costs loop sees; MCP hides per-call usage.
3. Termination emergent: B admits (03-options:49). Every infinite-loop failure = repeated path without bound (01:59); Anthropic's agent spawned 50 subagents, searched endlessly for nonexistent sources (01:58). Obscure namesake = nonexistent source.
4. Non-determinism breaks demo + replay: ledger replay easy for recipe; for B plan is tool-call history, so cached run replays one lucky trajectory. Goal-switch diff compares two trajectories, not two filters.
5. Emergent plans not greppable at 4am: tool_calls table has no intent. Missing claim traces to model choice made once, not reproducible. Elephant 2: fixed plan "honest, debuggable, demoable".
6. Dynamic loop can hide gaps: `mark_gap` is model's choice; model giving up quietly emits no gap. Recipe makes gap structural: step X returned nothing. T1 PARTIAL + T5 timeout gaps are deterministic step outcomes. 3–13% fabricated citations hit self-sourcing LLM hardest.
7. Setup buys nothing jury scores: MCP auth, Supabase, guardrails (03-options:53). Realtime WS gains only liveness A's SSE already provides.

## What must be true for B to be safe
- Actors via `apify-client`, not MCP.
- Hard budget of calls/USD/wall-clock enforced outside model; URL dedupe.
- Coverage checklist from goal questions + hard cutoff; gaps computed as "question with no claim", not declared by model.
- Every tool call + result in ledger; replay serves results from ledger with decisions pinned, labeled CACHED.
- Verify/citation separate from loop; FACT requires excerpt in ledger.
- Realtime optional; SSE first; e2e by T+5h.
If all six hold, what's left is A with an LLM choosing step order.

## Verdict
Unsafe as specified: MCP loses cost cap and output, replay not reproducible, gaps depend on model volunteering. Viable only after fixes turn it into bounded, ledger-replayable A.
