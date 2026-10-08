# Brainstorm: Social Media Deep Research (Hackathon Case 01, Apify)
**Mode**: Ideas for new product
**Context**: Agentic OSINT-lite tool. Input: subject + one anchor + goal. Output: sourced report, fact split from inference, gaps stated, goal changes substance. Judged 35% value / 25% originality / 20% working e2e / 10% tech / 10% honesty. One night, team ≤3, Apify actors as scraping layer.

**Framing insight**: brief tells us jury does NOT score scraping or summarising. It scores (1) entity resolution, (2) goal logic, (3) provenance/confidence, (4) legibility of process. Every idea below must land on at least one of those four.

---

## PM Perspective (user value, business impact)

1. **Goal = Question Set, not prompt flavour** — each goal (hiring / sales / due diligence / fake-account) is a hard-coded list of questions the report must answer ("Does tenure claim match registry?", "Who do they sell to?"). Report = answers to that list, each with source + confidence + "unanswered". Switching goal visibly swaps the question list. Directly hits "what wins". | Impact: H | Effort: L
2. **Gaps as first-class output** — "What we could NOT find" section with *why* (no public profile / ambiguous namesake / source blocked). Judges score honesty at 10% and value at 35%; a recruiter trusts a tool that says "no evidence" more than one that fills space. | Impact: H | Effort: L
3. **Fake-account detector as the sharp wedge** — of four goals, fake-account detection is most binary, most demoable, most Apify-native (profile age, follower graph, posting cadence, cross-platform consistency). Deliver as "evidence table for/against the account being what it claims". Avoid "trust score" (out of bounds) by never collapsing to a number. | Impact: H | Effort: M
4. **Czech registry anchor (IČO / ARES / justice.cz)** — jury is Czech, Apify is Czech. Resolving person↔company via ARES / Obchodní rejstřík is high local value, low competition (most teams go LinkedIn-only). Due-diligence goal becomes genuinely sourced. | Impact: H | Effort: M
5. **Drafted outreach as proof of goal logic** — one drafted message per goal, each sentence footnoted to a claim in the report. Shows the goal changed the *substance*, not headings, and ElevenLabs can read it aloud for the side prize. | Impact: M | Effort: L
6. **Contradiction ledger** — explicit list: "LinkedIn says CTO since 2021; registry says statutory body since 2023". Cross-checking is in-bounds and visibly original. | Impact: H | Effort: M

## Designer Perspective (UX, legibility, delight)

7. **Live investigation board** — streaming UI shows agent's plan as a tree: candidate entities → merge/split decisions → source fetches → claims. User watches identity resolution happen. "User understands how the report is put together" is a stated win condition. | Impact: H | Effort: M
8. **Candidate lineup for namesakes** — before deep research, show 2–5 candidate "Jan Novák"s with distinguishing evidence (city, employer, photo hash match) and let user confirm or let agent auto-pick with stated confidence. Makes identity resolution a visible, understandable step instead of hidden magic. | Impact: H | Effort: M
9. **Claim card** — every claim rendered as: statement · FACT/INFERENCE badge · confidence · source chips (click = exact quote highlighted) · "contradicted by" link. One component, reused everywhere; the whole report is a list of claim cards grouped by goal question. | Impact: H | Effort: L
10. **Diff view between goals** — run two goals, show side-by-side what changed. Cheapest way to prove "different goal, different report" on stage in 10 seconds. | Impact: M | Effort: L
11. **Voice briefing (ElevenLabs)** — 45-second spoken summary that reads *only* FACT-tagged claims with sources, says "I could not confirm…" for gaps. Honest voice = side prize + reinforces main criteria. | Impact: M | Effort: L
12. **Redaction-by-design indicators** — visible "Art. 9 filter active" badge; if a source contains health/politics/etc. agent logs "skipped protected category" without content. Turns a hard rule into a visible feature. | Impact: M | Effort: L

## Engineer Perspective (technical leverage, reliability)

13. **Claim graph with provenance** — every scraped item becomes a `Source{url, fetched_at, excerpt, actor}`; every claim is `Claim{text, kind: fact|inference, confidence, supports: [source_id], contradicts: [claim_id]}`. Report is a *view* over this graph; goal selects/filters/orders. Makes "different goal, different report" structural, not prompt-luck. | Impact: H | Effort: M
14. **Entity resolution as scored merge** — candidate profiles scored on anchor match (city / domain / IČO), name similarity, photo similarity (perceptual hash), cross-links (LinkedIn → website → X bio). Threshold → merge / split / ask. Deterministic, explainable, cheap. | Impact: H | Effort: M
15. **Apify actors as tools, LLM as planner** — expose ~6 actors (Google SERP, LinkedIn profile, Instagram profile, X profile, website crawler, ARES lookup) as function tools; planner loop decides which to call given goal + open questions. Avoids writing scrapers (out of bounds) and makes the "agentic" part real. | Impact: H | Effort: M
16. **Goal-question coverage loop** — agent stops when every goal question is answered or marked unanswerable after N attempts; not when context is full. Gives natural terminating condition and the "gaps" output for free. | Impact: H | Effort: L
17. **Run ledger + replay** — persist every actor call + LLM call with cost/time; "cached run" for video is just a replay of a ledger. Also satisfies global LLM-run-evidence rule and lets you show jury the exact evidence trail. | Impact: M | Effort: L
18. **Raw-data TTL + delete button** — scraped payloads stored with expiry; one-click purge after judging. Hard rule turned into a demo-able feature. | Impact: L | Effort: L
19. **Verification pass with a second model** — cheap model re-reads each FACT claim against its source excerpt, downgrades to INFERENCE if not literally supported. Mechanical honesty; strong "validation" score. | Impact: H | Effort: L

---

## Top 5 Recommendations

| Rank | Idea | Why | Quick Win? |
|------|------|-----|------------|
| 1 | #13 + #1 Claim graph + goal question sets | Makes every win criterion structural: goal changes content, provenance per claim, gaps are unanswered questions. Everything else hangs off this. | No (core) |
| 2 | #14 + #8 Scored entity resolution + candidate lineup | Namesakes are explicitly named in "what wins"; most teams will skip. Visible + explainable. | Medium |
| 3 | #7 + #9 Live investigation board + claim card | Covers "user understands how report is built". Streaming tree + one component. | Medium |
| 4 | #19 Second-model verification pass | 10% validation score for ~50 lines. Also prevents demo embarrassment. | Yes |
| 5 | #4 Czech registry anchor (ARES / IČO) | Local jury, local partner, due-diligence goal becomes real. Differentiator vs LinkedIn-only teams. | Yes (ARES has free JSON API) |

**Wedge for demo**: fake-account detection (#3) or due diligence on a Czech company founder (#4). Both benefit from registry cross-check and contradiction ledger (#6).

**Side prize**: #11 voice briefing reading only FACT claims. ~1h.

**Skip**: anything resembling a score of a person, sentiment analysis, "personality insight", automated outreach. All out of bounds and distract from criteria.

## Next Steps
→ Discovery: who exactly is the user per goal, what question set each needs, which Apify actors exist and their limits (rate, cost, auth).
→ Pre-mortem: what kills this at 4am.
→ Architecture: claim graph store, planner loop, streaming UI, actor adapter layer.
