# 13 — Steelman court

Three independent prosecutors (fresh context, each given only the dossier pages 10–12 and CLAUDE.md) attacked one option each. The advocate rebuttals and cross-examination were written afterwards by the orchestrating session.

## Option A — "Role text is the position"

### Prosecution
**Core charge:** A calls a text string an aggregate. It adds one column, and the column is never read.
1. **`posting_url` is decoration.** The posting is never fetched, so two recruiters pasting different postings with the same title get identical research. The URL is an outbound link and nothing more.
2. **Must-haves drift per candidate.** `role_questions` runs once per run and the LLM is nondeterministic. Ten candidates get ten question sets; the `/roles/[key]` coverage table becomes a union of near-duplicates and candidate 3 cannot be compared with candidate 7 on the same axis.
3. **`roleKey` is brittle.** "Senior Backend Engineer", "Sr. Backend Developer" and "Backend Engineer (Senior)" are three positions; a typo splits one.
4. **No identity for a position.** No company, location, board or external id, so two employers' "Data Analyst" merge: the namesake problem reproduced on the position side.
5. **Prefill is lossy.** A one-character edit on the pre-filled form forks the key silently.

Demo-day: the peer's `/roles` pages already exist, so A adds a link list; no originality lift. "Paste the posting, get tailored research" is the obvious demo and A cannot do it. The page implies the position has requirements when it has an LLM guess per run (honesty risk). Data-model dead end: the promised backfill has no authoritative must-haves to adopt. At 3 positions × 10 candidates: 6–9 role keys, no "same bar for everyone", no cross-position duplicate warning. Agentic pitfall: the cheap diff invites layering string heuristics onto `roleKey` and rebuilding B badly.

### Advocate rebuttals (prosecutor's own assessment in brackets)
1. Time is the scarce resource; A is done in 1.5 h and leaves hours for the E3 gate. [Survives, but does not answer the value critique.]
2. Exit cost is near zero. [Partly: the table is reversible, the un-stored must-haves are not.]
3. Pasted text and free-text role are the robust inputs; ingest is UNVERIFIED on Workers egress. [Survives against B and C for LinkedIn only; Jobs.cz and the ATSs are tested free paths.]

**Verdict:** fallback tier only. As the chosen option it fails "same questions for every candidate", which is the point of a position.

## Option B — Positions table, strategy-chain ingest, families by enum

### Prosecution
1. **The ingest it depends on is unproven where it runs.** The matrix was tested from a residential IP; LinkedIn from Workers egress is UNVERIFIED and Cloudflare egress ranges are widely blocklisted. The Apify fallback costs $0.50 per job because of the `maxTotalChargeUsd` floor, and its cold start against 45 s is unverified. The chain (fetch 20 s + retry, guest fetch, Apify poll, LLM extract) runs in a synchronous route handler with no Workflow durability; a half-finished ingest leaves an R2 orphan and no row, and the synthetic `position:<id>` ledger key has no budget owner.
2. **Extraction quality is unmeasured.** No boilerplate stripping, no eval set. Must-haves are fixed once and copied into every candidate's `questions_json`, so one bad extraction damages every run for that position and `role_questions` cannot recover it. Family assignment is a second failure surface for a feature the demo barely uses.
3. **Two lists.** `/positions` beside the peer's staged `/roles` means two grouping keys, two dedup keys and two pages, landing on uncommitted work with an unresolved conflict in `parts.tsx`.
4. **Migration-before-deploy.** 0009 touches the hot `INSERT` in `POST /api/runs`; until Robert migrates remote D1, production 500s. Purge keys on `investigations.created_at`, which positions do not have; `positions`, its ledger and the R2 prefix all need their own sweep, or raw postings survive judging (hard-rule break).
5. **Time and agentic risk.** Five parsers, a plan function, an extract seam, a migration, two routes, two pages, `StartRunBody`, purge, the cheat file. Parallel agents collide on `run-body.ts`, `runs/route.ts` and `purge.ts`. Fixtures written from tonight's HTML go stale while tests stay green.
6. **Demo scoring.** The visible payoff, "same questions across candidates", is real but subtle, and A plus a pasted-text box gets most of it. A live ingest that 429s costs end-to-end and honesty together.

### Advocate rebuttals
1. Pasted text is first-class, so the chain degrades gracefully. [Survives partly; it concedes the chain is optional.]
2. Stable per-position must-haves is the capability A cannot deliver. [Survives; needs only `must_haves_json` plus paste, not five parsers.]
3. Pure-function seams shipped in 10–15 min each tonight. [Weak: those had no network, migration or purge.]

**Verdict:** B's data model survives; the strategy chain does not. Cut it to `pasted` plus Jobs.cz / ATS JSON, and drop Apify and LinkedIn guest until a Workers egress test passes.

## Option C — Position as a research run

### Prosecution
1. **Workflow latency for a paste.** The first interaction becomes a 1–3 min spinner; a failed step stalls the flow.
2. **Budget rules written for persons.** `company_site_crawl` and `similar_postings_serp` are paid; the $0.50 Apify floor can eat the whole run budget for what is a free fetch.
3. **`goal` CHECK constraint.** SQLite cannot alter a CHECK, so `investigations` must be rebuilt (four FK tables); then every `goal === 'hiring'` branch (role questions, interview kit, "Hiring for", `/roles`, summary, identity map, candidate copy, audit) needs auditing through uncommitted peer work.
4. **Goal-delta test hollow.** A position has no subject; identity and namesake machinery is skipped by special case.
5. **Extension contract and subject semantics.** `{subject, anchor}` do not exist for a posting; `RunState`, dedupe and the run page assume a person. Must-haves as FACT claims is circular: a requirement is not a fact about the world.
6. **CACHED hides expired postings; purge of the position run orphans the candidates' question provenance.**

### Advocate rebuttals
1. FACT-with-quotes must-haves are the originality. [Partly survives, but fits B's extract schema without a Workflow.]
2. No new aggregate; replay works for free. [Mostly fails.]
3. Company crawl reused by due-diligence. [Fails for tonight: speculative scaffolding.]

**Verdict:** latency, migration and subject-semantics attacks stand.

## Cross-examination (orchestrator)
- **A vs B on time**: A's 1.5 h is real, but A cannot give the same questions to every candidate, and that is the only reason a position exists. B without the fetch chain is ~2.5 h and keeps that property. A's time advantage shrinks to about an hour.
- **B's chain**: accepted. Ingest = pasted text first; free fetches (Jobs.cz JSON-LD, Greenhouse/Lever/Ashby JSON, generic JSON-LD) second; LinkedIn guest only after a one-line Workers egress probe passes (E1); **no Apify in ingest**. With no paid actor the synthetic ledger key goes away; the LLM extract cost lands on the `positions` row (`ingest_cost_usd`, `ingest_method`), satisfying "no silent spend".
- **Two lists**: `/positions` replaces the `/roles` link on the home page; `/roles` stays as the legacy grouping for runs without `position_id` and reuses the same projection code with `position_id` as the primary key and `roleKey` as the fallback. One table component, two routes.
- **Purge**: `positions` gets `expires_at`; `purgeExpired` adds one statement for positions past `expires_at` plus their R2 objects. One test.
- **Extraction quality**: strip sections headed About us / Benefits / EEO before extract (pure function with fixtures); the extracted must-haves are editable on `/positions/[id]` before any run uses them. A bad extraction is fixed once, not per run.
- **Migration**: `position_id` nullable; the INSERT only names the column when a `positionId` is in the body, so an un-migrated remote keeps working for runs without a position.
