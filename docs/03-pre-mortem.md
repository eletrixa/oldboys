# Pre-Mortem: Social Media Deep Research (Case 01)

**Date**: 2026-10-08
**Status**: Draft
**Scenario**: It is sunrise. Repo frozen. Demo flopped or jury scored us mid-table. Why?

### Risk Summary
- **Tigers**: 11 (6 launch-blocking, 3 fast-follow, 2 track)
- **Paper Tigers**: 5
- **Elephants**: 5

---

### Launch-Blocking Tigers

| # | Risk | Likelihood | Impact | Mitigation | Owner | Deadline |
|---|---|---|---|---|---|---|
| T1 | **LinkedIn returns nothing** from Apify cloud (authwall). Demo subject has only LinkedIn → empty report. | H | H | E1 at T+0:20. If dead: LinkedIn demoted to SERP-snippet source, labeled PARTIAL. Pick demo subjects with IG/X/website/ARES presence. Never promise LinkedIn in video. | Sources | T+1h |
| T2 | **Goal switch looks cosmetic.** Jury flips hiring→due diligence, sees same claims with different headers. Out-of-bounds "search and summarise". | M | H | Goal = hard question list that *filters* claim graph; a claim not mapped to a goal question is not rendered. E3 before UI. Diff view shows claim-level delta on stage. | Planner | T+3h |
| T3 | **Wrong namesake merged** on stage. Report about different Jan Novák. Kills "identity resolution" criterion and trust. | M | H | Candidate lineup always shown; auto-pick only above threshold, else ask. Demo flow: pause on lineup, point at anchor evidence. Rehearse on 3 subjects. | Resolver | T+6h |
| T4 | **No end-to-end run by T+5h.** Three parallel tracks (planner / UI / sources) never meet. Sunrise = three demos, zero product. | M | H | Walking skeleton first: hard-coded claim JSON → claim cards on screen at T+2h. Every track plugs into that contract. Scope freeze rule from discovery §7. | Lead | T+2h |
| T5 | **Live run stalls > 2 min on stage** (actor queue, rate limit, LLM latency). Audience watches spinner, 90-s video wasted. | M | H | Stream first claim < 20 s. Per-actor timeout 45 s, then "source timed out" gap. Ledger replay as backup (labeled CACHED). Cap sources per goal to ≤5 calls. | Planner | T+7h |
| T6 | **Hallucinated FACT with fake URL** found by jury in 10 seconds. Honesty score 0, value score collapses. | M | H | FACT only if verify pass finds literal support in stored excerpt; URL must come from ledger, never from LLM. Second model verify (E6). Claim card shows excerpt, not just link. | Planner | T+7h |

### Fast-Follow Tigers

| # | Risk | Likelihood | Impact | Planned Response | Owner |
|---|---|---|---|---|---|
| T7 | Art. 9 leak: a scraped post mentions health/politics; summary repeats it. Hard-rule breach on stage. | M | M | Pre-synthesis filter: classifier on excerpts, drop + log "skipped protected category". Pick demo subjects where this is unlikely. Visible badge. | Planner |
| T8 | Apify credits burn out at 4am (loops re-calling actors). | M | M | Hard call budget per run (e.g. 12 actor runs), cost logged in ledger, dedupe by URL. | Sources |
| T9 | Video over 90 s / no "live vs cached" label / missing in HQ before freeze. Disqualifying admin error. | M | H | Video script written at T+7h, 70-s target, label burned in. Submit at T+9:30, not T+9:59. | Lead |

### Track Tigers

| # | Risk | Trigger | Response |
|---|---|---|---|
| T10 | ARES / justice.cz name search ambiguous (common surnames) | E4 shows >5 hits for demo person | Require IČO or company name as anchor for due-diligence demo; state limitation. |
| T11 | ElevenLabs integration eats > 1h | At T+8:30 not working | Cut. Side prize is optional. |

---

### Paper Tigers

| Concern | Why manageable |
|---|---|
| "We need all 4 goals polished" | Jury scores *that* goal switch changes substance, not breadth. Two goals done well (due diligence + hiring, or due diligence + fake-account) beats four thin. |
| "Need our own scrapers for better data" | Explicitly out of bounds and 0 points. Actors + ARES REST + GitHub API cover it. |
| "Confidence levels must be calibrated" | Jury wants *a* confidence with reasoning, not calibration. Three bands (high/med/low) with rule: high = ≥2 independent sources agree; med = 1 source; low = inference. State this in README. |
| "GDPR / consent for demo subject" | Brief explicitly says public data, no consent needed, demo self or public figure. Use team member + public founder. Purge button covers deletion rule. |
| "Need deep-research API for quality" | Allowed as one component but jury scores what's on top. Fine to skip entirely; SERP + planner is enough. If used, label as "seed source". |

### Elephants in the Room

1. **Nobody has tested the actors yet.** Whole plan rests on A1/A2. First hour must be source reality check, not Next.js scaffolding. *Conversation: "Who runs E1 at minute zero, before anyone opens an editor?"*
2. **Agentic ≠ better.** A planner loop that picks actors dynamically is cooler but riskier than a fixed per-goal pipeline. Fixed pipeline per goal (5 steps each) is honest, debuggable, demoable, and still "agentic" in the jury's eyes if the UI shows decisions. *Conversation: "Do we actually need a tool-calling loop, or a goal→plan table plus LLM synthesis?"* Recommendation: fixed plan per goal + LLM only for resolution scoring, synthesis, verify. Add dynamic re-planning only if time at T+7h.
3. **Demo subject choice is a product decision.** If we demo on ourselves, LinkedIn-dead risk is hidden and namesake handling is untested. If we demo on a public figure with many namesakes, resolution shines but data volume may blow timeouts. Need one of each, rehearsed. *Conversation: "Which three subjects, decided by T+1h?"*
4. **UI will eat the night.** Designers in team will polish claim cards while planner has no verify pass. Rule: UI work gated on E3 passing. *Conversation: "What does UI person do for first 3 hours?"* Answer: claim card + board against hard-coded JSON, then ledger viewer.
5. **Honesty section is scored but will be written at 5am.** 10% of score for a README section nobody owns. *Conversation: "Who owns README + limitations, and when?"* Start at T+0 (discovery §8 already has it), append through the night.

---

### Go/No-Go Checklist (T+9h)

- [ ] E1 result known and LinkedIn status written in README
- [ ] One live run on a fresh subject completes < 3 min, streamed
- [ ] Goal switch on same subject shows claim-level diff
- [ ] Candidate lineup shown for at least one namesake case
- [ ] Every FACT card has excerpt + ledger URL; verify pass log visible
- [ ] Ledger replay works (CACHED label visible)
- [ ] Raw-data purge button works
- [ ] README: what's live / cached / mock, limitations, Art. 9 handling, delete policy
- [ ] Video ≤ 90 s, labeled, uploaded to HQ ≥ 30 min before freeze
- [ ] Last commit pushed before sunrise
