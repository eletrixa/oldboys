# Discovery Plan: Social Media Deep Research (Case 01)

**Date**: 2026-10-08
**Product Stage**: new (hackathon, one night, team ≤3)
**Discovery Question**: Which goal + source combination can we take from real input to sourced, goal-shaped, honest report by sunrise, and what has to be true for that to work?

Inputs: `docs/brief.md`, `docs/01-brainstorm.md`, web check of Apify store + ARES (2026-10-08).

---

## 1. Users per goal (who, what they do today, what they need answered)

| Goal | User | Today | Question set (what report must answer) | Decision they make |
|---|---|---|---|---|
| **Hiring** | Recruiter / hiring manager | 20–40 min per candidate: LinkedIn, GitHub, Google, maybe company site. Acts on gut. | Is this the right person (not namesake)? Does public work history match CV? Public work samples / talks / repos? Tenure gaps? Public claims contradicted elsewhere? | Shortlist / reject / ask candidate |
| **Sales** | SDR / AE | LinkedIn + website + Crunchbase. Wants hook for first line. | Current role + company? What company sells, to whom, size? Recent public activity (posts, talks, hires, funding)? Who else at company is relevant? What would a credible opener reference? | Draft outreach (shown, not sent) |
| **Due diligence** | Investor / partner / procurement | Registry + press + LinkedIn, manually. Hours. | Legal entity confirmed (IČO, seat, statutory bodies, founded)? Person↔company link proven? Other companies same person sits in? Insolvency / liquidation flags in public registry? Claims on website vs registry contradictions? Press coverage? | Proceed / escalate / stop |
| **Fake-account detection** | Trust & safety, journalist, HR verifying applicant | Eyeballs profile. No method. | Does account exist on ≥2 platforms with consistent identity? Account age vs claimed history? Follower/following pattern? Photo reused elsewhere (reverse image)? Bio claims verifiable against any registry/employer page? | Treat as genuine / suspicious / unverifiable (never a score) |

Common to all: **every answer = claim card** (FACT/INFERENCE, confidence, source, contradicted-by) and **unanswered = stated gap with reason**.

Czech angle: jury + partner Czech. Due-diligence and hiring goals get real teeth from ARES/justice.cz. Most teams will go LinkedIn-only.

## 2. Source landscape (verified 2026-10-08)

| Source | Route | Auth / cost | Risk |
|---|---|---|---|
| Google SERP | Apify `apify/google-search-scraper` (99.9% success, 11M runs) | ~$0.001 start + usage | Low. Primary discovery + namesake enumeration. |
| LinkedIn public profile | Several no-cookie actors (`curly/…`, `bovi/…`, `kalirobot/…`, $1.4–10 / 1k) | pay per result | **HIGH**: reports that LinkedIn authwalls anonymous cloud IPs → zero data. Must test at kick-off; fallback = SERP snippet + cached HTML + label. Cookie-based actors exist but use own account = risk; brief says public profiles fine, but don't burn team account on stage. |
| Instagram profile | `apify/instagram-profile-scraper` (99.8%, 8.4M runs) | ~$0.0027/result | Low–medium. Public profiles only. |
| X / Twitter | Tweet Scraper V2 (99.9%, 5.7M runs) | pay per result | Medium. Good for account-age / cadence signals (fake-account goal). |
| ARES (CZ company registry) | Direct REST v3 `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat` + `/ekonomicke-subjekty/{ico}` | free, no key | Low. JSON. Gives name, IČO, seat, legal form, NACE. Also Apify actors `foxlabs/czech-company-data`, `osmateus/czech-ares-company-api` add directors/VAT. |
| justice.cz (Obchodní rejstřík, statutory bodies, insolvency) | `or.justice.cz` full extract; Apify actors exist | free | Medium: HTML, person→companies lookup needs name+birthdate or iterating. Use Apify actor if one covers it (brief: don't write scrapers already covered). |
| Company website | `apify/website-content-crawler` | usage | Low. |
| Reverse image | No clean public API; Google Lens via SERP actor partially | — | Medium. Use perceptual-hash match between platforms only (we hold both images). Label as INFERENCE. |
| GitHub | REST API, free | token optional | Low. Hiring goal. |
| Existing deep-research API (Perplexity / Exa / Tavily) | allowed as one component | key | Jury scores what's on top. Use for breadth seed only, never as the report. |

Orchestration: **Apify MCP server** (`mcp.apify.com`) exposes any actor as tool with input + inferred output schema. Or Apify client SDK directly (`apify-client` JS/Python) — more control over cost caps and timeouts. Decide in architecture.

## 3. Selected ideas carried forward (from brainstorm top 5)

1. Claim graph + goal question sets (#13 + #1)
2. Scored entity resolution + candidate lineup (#14 + #8)
3. Live investigation board + claim card UI (#7 + #9)
4. Second-model verification pass (#19)
5. Czech registry anchor (#4)
+ ElevenLabs voice briefing of FACT-only claims (#11) as side prize.

## 4. Critical assumptions

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| A1 | No-cookie LinkedIn actors return real data from Apify cloud on the night | Feasibility | H | H | **1** |
| A2 | Google SERP actor reliably surfaces ≥2 candidate namesakes for a common Czech name + anchor | Feasibility / Value | H | M | 2 |
| A3 | An LLM given goal question set + claim graph produces materially different reports per goal (not just reordered) | Value | H | M | 3 |
| A4 | Jury perceives candidate lineup + FACT/INFERENCE split as "understands how report is built" | Value / Usability | H | M | 4 |
| A5 | Entity-resolution scoring with anchor+name+cross-links is good enough to be right on 3 demo subjects | Feasibility | H | M | 5 |
| A6 | Full run (SERP + 3 profiles + ARES + synthesis + verify) finishes < 3 min with streaming so demo doesn't stall | Feasibility | M | M | 6 |
| A7 | Second-model verify pass actually downgrades bad FACTs rather than rubber-stamping | Value (honesty) | M | M | 7 |
| A8 | ARES / justice.cz person→company resolution works for demo subject (needs name match, ideally birthdate not available) | Feasibility | M | H | 8 |
| A9 | Total Apify + LLM spend for night + demo < free credits / small budget | Viability | L | L | 9 |
| A10 | ElevenLabs TTS integration < 1h | Feasibility | L | L | 10 |
| A11 | 3 people can split planner / UI / sources without integration hell before sunrise | Feasibility | H | M | — (process) |

Leap-of-faith: **A1, A3, A5**. If LinkedIn dies and goal-switch looks cosmetic and namesakes merge wrong, product is "search and summarise" = out of bounds.

## 5. Validation experiments (all inside hackathon clock)

| # | Tests | Method | Success criteria | Effort | When |
|---|---|---|---|---|---|
| E1 | A1 | At kick-off, run 3 no-cookie LinkedIn actors against 3 known public profiles from Apify cloud | ≥1 actor returns headline + experience for ≥2/3 | 20 min | T+0:20 |
| E2 | A2, A5 | SERP actor for "Jan Novák Brno" and 2 team-member names; count distinct candidates; hand-label which is right | ≥2 candidates found; anchor disambiguates correctly in 3/3 | 30 min | T+1:00 |
| E3 | A3 | Before any UI: fixed claim graph JSON (hand-made, 30 claims) → run synthesis with 4 goals → diff | ≥50% of claims selected differ between hiring and due-diligence; question lists differ fully | 45 min | T+2:00 |
| E4 | A8 | ARES search by name + justice.cz for one team member / mentor who has a company | Entity + statutory body found with source URL | 20 min | T+1:30 |
| E5 | A6 | Time one full pipeline run with logging | < 3 min wall; first claim streamed < 20 s | 15 min | T+6:00 |
| E6 | A7 | Inject 3 deliberately unsupported FACT claims into verify pass | All 3 downgraded | 15 min | T+7:00 |
| E7 | A4 | Show 90-s dry run to a non-team person in lobby, ask "how did it decide which Jan Novák?" | They answer correctly without prompting | 10 min | T+9:00 |

## 6. Timeline (hackathon hours)

- **T+0–1h**: E1, E2, E4 (source reality check). Lock source list. Decide LinkedIn fallback.
- **T+1–3h**: Claim graph schema, goal question sets, E3. Planner loop skeleton. UI claim card + board stub.
- **T+3–7h**: Entity resolution, actor adapters, verify pass, streaming. E5, E6.
- **T+7–9h**: Demo subjects (self + one Czech company founder + one fake-ish account), ledger replay for video, ElevenLabs.
- **T+9–10h**: E7, video (≤90 s), README with honest limitations, raw-data purge button, freeze.

## 7. Decision framework

- **E1 fails** (LinkedIn dead): drop LinkedIn to "SERP snippet + label PARTIAL"; lean demo on due-diligence (ARES + website + X/IG) and fake-account (IG + X). Still in bounds.
- **E2 fails** (no namesakes surfaced): demo with name that has known namesakes (pick at T+1); keep lineup UI, state limitation.
- **E3 fails** (goal diff cosmetic): fix question sets, not prompt; make question list hard filter over claims, then re-run. Don't touch UI until this passes.
- **E5 fails** (>3 min): cut source count per goal to 3; cache; stream earlier.
- **E8 implicit**: if by T+5h no end-to-end run exists, freeze scope to one goal (due diligence) + one subject. 20% e2e + 35% value beats breadth.

## 8. Honest-limitations list (start now, ship in README)

- LinkedIn coverage depends on actor availability; state which runs were live vs cached.
- Reverse-image match is perceptual hash across sources we fetched, not web-wide.
- Registry coverage: CZ only (ARES/justice.cz); other countries via SERP only.
- No Art. 9 inference; filter is prompt + post-check, not provable.
- Confidence levels are model-assigned with verify pass; not calibrated.
- Raw scraped data purged after judging (button + TTL).
