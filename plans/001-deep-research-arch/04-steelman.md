# 04 — Steelman court

Six independent agents (3 Advocates, 3 Prosecutors), disjoint prompts, same evidence pack (`01`, `02`, `03`, `docs/03-pre-mortem.md`). Full arguments in `evidence/steelman-{A,B,C}.md`. This file: cross-examination and verdict inputs.

## Cross-examination

### Option A — Recipe
**Advocate's strongest point**: only option that protects 20% e2e structurally; T4/T5/T8 are loop parameters, not guardrails to build; value lives in verification (none of 4 OSS agents verify citations), which is a pipeline stage.
**Rebuttal**: true but incomplete. Value 35% + originality 25% = 60% of score sits on "goal changes substance" and "namesakes handled". A fixed loop delivers those only if the recipe *branches* on evidence. Without a branch, Prosecutor A's attack #1 holds: it's a configured search-and-summarise.

**Prosecutor's strongest point**: nothing in A decides anything the recipe author didn't decide in advance; `resolve` is a single early step every later step inherits, so a wrong merge poisons everything and `possibly-same-as` can't be carried forward.
**Rebuttal**: both fixable inside A without becoming B. (1) Two structural branches: `resolve` emits `candidates[]` with `merge | possibly-same-as | ask` and the run **pauses** for user when below threshold (brief's "what wins" wants exactly this visible). (2) Every fetch step has an `onEmpty` fallback declared in the recipe (LinkedIn empty → SERP snippet step, labeled PARTIAL). These are declared, greppable branches, shown as decisions in the UI. Prosecutor's own "what must be true" list is satisfied by these plus ledger-resumable steps.

### Option B — Agent
**Advocate's strongest point**: goal drives tool choice at the root, so T2 (cosmetic goal switch) is solved structurally; MCP breadth lets planner route around T1.
**Rebuttal**: Prosecutor B shows the same divergence is achievable by a recipe whose step list differs per goal, deterministically and diffably. Breadth over 30k actors is irrelevant when we will have tested 6 by T+1h; untested actors at 3am are a liability, not breadth. And routing around an empty source is an `onEmpty` branch, not a planner.

**Prosecutor's strongest point**: MCP `call-actor` returns no output and no cost cap; replay is one lucky trajectory; gaps depend on the model volunteering them.
**Rebuttal attempt**: Advocate's hybrid (apify-client for known actors, hard budget outside model, gaps computed as "question with no claim") answers each point. But Prosecutor's closing stands: after those fixes "what is left is A with an LLM choosing step order". The rebuttal concedes the architecture.

### Option C — Dossier
**Advocate's strongest point**: walking skeleton *is* the architecture; replay, golden tests and audit trail come free; T4/T5 structurally handled.
**Rebuttal**: all true and all portable into A. A single Next.js process can write `runs/<id>/ledger.jsonl` + `claims.json` exactly as C does and stream the same events over SSE. C's advantages are a storage discipline, not a topology.

**Prosecutor's strongest point**: brief and go/no-go say "streamed"; CLI can't pause for namesake confirmation; polling a rewritten file is fake streaming.
**Rebuttal attempt**: pre-run `--pick` step and 1 s polling. Weak: still two processes, still no mid-run ask, still "looks like a recording".

## Verdict inputs
- A's prosecution is strong and specific → court did its job. Its conditions ("one genuine runtime branch", "`resolve` can pause", "ledger-resumable") become **requirements** of the recommendation, not optional polish.
- B's defence conceded the architecture: bounded, ledger-replayable, apify-client-based B *is* A.
- C's defence proved storage discipline, not topology. Adopt the discipline, reject the topology.
- Winner's prosecution (A) becomes risk register in `00-SYNTHESIS.md`.
