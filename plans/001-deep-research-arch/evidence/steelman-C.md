# Option C — Advocate

## Strongest case
1. Walking skeleton IS the architecture (T4): `claims.json` is the contract; viewer builds against fixture day one; CLI replaces fixture later. A and B must stand up routes/SSE/Realtime/DB before tracks meet.
2. Stall on stage structurally impossible (T5): replay = serve old folder (03-options C). Go/no-go "ledger replay works" passes free.
3. Golden-file tests cover hallucination (T6): quote-in-excerpt check is pure function over `sources/` + `claims.json`. "Best of the three" test seams. 3–13% fabricated URLs; none of OSS agents verify.
4. Ledger is the product; honesty 10%: ledger source of truth, `claims.json` projection. Live/cached/mock labels read from files. Matches Sayari raw retention, Hunter source rows, Anthropic tracing. Jury can open the folder.
5. Follows pre-mortem fixed-pipeline decision (Elephant 2); caps cheaper when each run is bounded process that exits.
6. Goal switch = diff of two files (T2); viewer stays small ("UI will eat the night").
7. Upgrade path cheap: wrap CLI in route handler → A; files → SQLite. No work lost.

## Conceded + reframe
- Wow lowest, no streaming tree: value 35% + e2e 20%; flawless beats flashy that stalls. CLI writes `claims.json` after each claim, viewer polls 1 s: looks like streaming.
- "Is it a tool?": fixed pipeline agentic if UI shows decisions; lineup, gap labels, visible ledger are the decisions.
- Originality: conventional structure; originality from claim model + lineup (shared). [rhetoric] auditable folder-as-evidence-bundle is own differentiator.
- Polling not live: accepted; ~1 s lag; removes Supabase/MCP risks.

## Verdict
Pick C if T4 and T5 dominate; replay, golden tests, on-disk audit come with design; spend saved hours on lineup + claim-card polish.

---

# Option C — Prosecutor

## Strongest attacks
1. Spec says "streamed"; C is only option that doesn't stream. Go/no-go demands live run "streamed". C's own cost line: "Wow: lowest".
2. No namesake confirmation = T3 failure as written: CLI can't ask mid-run; blocks stdin or auto-picks. Checklist "lineup shown" becomes post-hoc display, not decision.
3. Perception: fixed pipeline excused only "if UI shows decisions" (Elephant 2); C's UI weakest at that.
4. Originality: evolution path is "wrap CLI → A". C is A minus live UI. [rhetoric] jury scoring.
5. "Live" seam fake and fragile: browser can't watch fs; needs server = second process + polling. [rhetoric] partial reads of `claims.json` mid-rewrite; needs atomic temp+rename, not in plan. 1 s poll + full-file rewrite clumsy for "first claim <20 s".
6. Drift to search-and-summarise: re-run and diff = two full runs, diff arrives minutes late; `report.md` as main artifact *looks like* search-and-summarise.
7. Demo: CLI + viewer server + browser all alive; CACHED fallback makes it feel like a recording. ElevenLabs has no surface beyond reading `report.md`. [rhetoric]

## What must be true for C to be safe
- CLI emits events (SSE) not file polling → at that point it is A.
- Lineup as pre-run `--pick` step: stop, show, confirm, resume.
- Atomic writes; one command starts both processes.
- Viewer renders ledger decisions (candidate scored, source skipped, verify failed).
- Diffs from cached ledgers so goal switch takes seconds.
- Jury values inspectable provenance over live feel; pack never shows they do.

## Verdict
Safest build, weakest demo: fails "streamed" and "namesake-ask" as written. Take A, keep C's ledger-first, golden-file discipline.
