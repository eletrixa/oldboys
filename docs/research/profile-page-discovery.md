# Candidate profile page: brainstorm, discovery, pre-mortem, spec

Date 2026-10-09. Objective: a recruiter opens the candidate profile and in 60 seconds knows achievements, risks, history, working style, fit for the role and what to ask. Inputs: `docs/brief.md`, `docs/research/josef-buryan-profile.md` and `-sections.md` (test subject), `Profile` in `src/domain/claim.ts`, `src/recipe/seams/profile.ts`, `src/app/runs/[id]/profile-sections.tsx`. Method: PM skills brainstorm-ideas-existing, discover steps 2-5, pre-mortem. No code changed.

Current state in one line: the profile seam makes two primary-model calls, drops evidence whose quote is not in the named source excerpt, computes `fit_pct` itself (has 1, partial 0.5, none 0), and the page renders the six sections with a native evidence disclosure per item.

## 1. Brainstorm (product trio, 5 ideas each)

| # | Perspective | Idea | One line | Impact | Effort |
|---|---|---|---|---|---|
| P1 | PM | 60-second verdict strip | Top band: role, fit %, top achievement, top risk, first question; the page in five lines | H | L |
| P2 | PM | Must-have scorecard as fit source | Fit traits come from the role's ingested must-haves (`POSITION_INGEST_USD`), not invented by the model per run | H | M |
| P3 | PM | Goal delta on the profile | Same subject, hiring vs due-diligence: profile sections change substance, shown side by side in the demo | H | M |
| P4 | PM | "Ask this" tied to risks | Every risk links to the question that closes it, and the question links back | M | L |
| P5 | PM | ATS paste of the profile | One-click plain-text copy of the six sections with source URLs for the ATS note | M | L |
| D1 | Designer | Evidence count chips | "3 sources, 2 FACT" chip in each item row so trust is scannable without opening anything | H | L |
| D2 | Designer | Weakens in red, inline | Any item with a `supports=false` line shows a conflict marker in the collapsed row | H | L |
| D3 | Designer | Show-more caps | Fixed visible counts per section, rest behind "show N more", so the first screen is the 60 seconds | H | L |
| D4 | Designer | Personality as a labelled aside | DISC/MBTI in a muted, bordered card with the disclaimer pill first, types after; never the biggest text on the page | H | L |
| D5 | Designer | Timeline with gap bars | History as a vertical timeline where overlaps and gaps (Vilgain vs Meta 2022) render as a visible marker | M | M |
| E1 | Engineer | Self-authored filter for personality | Personality evidence accepted only from sources the subject wrote (own posts, about, own talk); reposts and press about them rejected in code | H | L |
| E2 | Engineer | Null types under evidence floor | If fewer than 3 surviving self-authored quotes, set DISC and MBTI to null in code, keep the read with "thin evidence" | H | L |
| E3 | Engineer | Trait list frozen per role | Fit traits fixed per role before the call so `fit_pct` cannot drift by the model choosing an easy denominator | H | M |
| E4 | Engineer | Truncation guard | Detect `finishReason=length` / schema failure on call 1, retry once with the source block halved, then degrade | M | L |
| E5 | Engineer | Golden Buryan fixture test | Snapshot the profile for the Buryan sources in a Vitest fixture; QA checklist below runs against it | M | L |

### Top 5

| Rank | Idea | Why selected | Key assumptions |
|---|---|---|---|
| 1 | E1 + E2 personality guardrails | The brief puts personality scores out of bounds and honesty is 10% of the score. Guardrails in code turn the riskiest feature into an honesty showcase | Judges accept a labelled, evidence-gated, nullable type as "inference", not a "score" |
| 2 | P1 verdict strip + D3 caps | The 60-second goal is a scanning problem; the profile already has the content | Recruiters read top-down and stop after one screen |
| 3 | D1 + D2 evidence chips and weakens marker | Makes "every claim links to a source" and contradictions visible without clicks; judges see it in a 90 s video | Counts and a red marker are read as trust signals, not noise |
| 4 | E3 frozen traits (from P2) | `fit_pct` is the number most likely read as a score; a fixed denominator makes it reproducible and explainable | Must-haves exist for the demo role (CMO tag is live) |
| 5 | P4 risk to question link | "What to ask" is the action the recruiter takes; linking closes the loop and shows goal logic | Each risk yields at least one question in the model output |

Parked: P3 (goal delta is already the E3 gate, show it in the video, no page work), P5 (ATS note exists), D5 (nice, costs time), E4 (32k output cap already set; see tiger T5), E5 (folded into QA).

## 2. Discovery: assumptions (steps 3-4)

V value, U usability, F feasibility, B viability (business, rules, judging). Impact and uncertainty H/M/L.

| ID | Idea | Cat | Assumption | Impact | Uncert. | Leap of faith |
|---|---|---|---|---|---|---|
| A1 | 1 | B | Jury reads DISC/MBTI with labels and evidence as allowed inference, not as a banned personality score | H | H | **Yes** |
| A2 | 1 | F | Enough self-authored text exists for a type (Buryan: 28 own posts, tweets, about) | M | L | no |
| A3 | 1 | V | A recruiter finds the working-style read useful beyond the achievements list | M | M | no |
| A4 | 2 | U | The verdict strip plus capped sections answer the six questions in 60 s | H | M | **Yes** |
| A5 | 2 | U | Hidden items behind "show more" are not missed when they matter (a risk) | M | M | no |
| A6 | 3 | V | Evidence chips raise trust more than they add clutter | M | M | no |
| A7 | 3 | F | Every evidence line resolves to a confirmed source with a working deep link | H | M | **Yes** |
| A8 | 4 | B | A fit % with a visible trait list is accepted as "evidence coverage of must-haves", not a candidate score | H | H | **Yes** |
| A9 | 4 | F | The model's traits for one role are stable across two runs (same subject) | M | H | **Yes** |
| A10 | 5 | V | Questions generated from risks are specific enough to use in a real interview | M | M | no |
| A11 | all | F | Two primary-model calls fit the $0.50 run budget alongside actors and other seams | H | M | **Yes** |
| A12 | all | F | The profile JSON is never truncated for a source-rich subject (96 sources for Buryan) | H | M | **Yes** |

### Impact x uncertainty

| | Low uncertainty | Medium | High |
|---|---|---|---|
| **High impact** | | A4, A7, A11, A12 | **A1, A8** |
| Medium | A2 | A3, A5, A6, A10 | A9 |

Test order: A1+A8 together (one jury-style read), then A7+A12 (one real run), then A4 (recruiter read), then A11 (ledger sum), then A9.

## 3. Experiments (step 5), all doable during the hackathon

| Exp | Tests | Method | Success criteria | Effort | When |
|---|---|---|---|---|---|
| X1 Jury proxy | A1, A8 | Show the Buryan page to 2 people not on the team, cold, ask: "Is anything here a personality or trust score of the person?" | Neither names the personality card or the fit % as a score once labels are visible. If either does, hide types by default (see T1) | L | 2026-10-09 evening |
| X2 Recruiter 60 s read | A4, A5, A3, A10 | 3 recruiters (or recruiting-adjacent friends) get the Buryan URL, 60 s timer, then answer 5 questions: top achievement, top risk, last two employers, would you interview for CMO and why, first question you would ask | 4 of 5 answered correctly by at least 2 of 3; the risk answer matches the page's first risk | L | 2026-10-09 evening |
| X3 Evidence link audit | A7 | Script over the Buryan brief: every `ProfileEvidence.source_id` is in the confirmed set and its quote is in the excerpt; click 10 deep links by hand | 100% resolve in script, 10 of 10 links land on text containing the quote | L | after first full run |
| X4 Big-subject run | A12, A11 | One live run on Buryan with full recipe; read `ledger_entries` cost and the profile `degraded` field | `degraded` null, every section non-empty, run total under $0.50 re-summed from ledger | M | before 2026-10-10 02:00 |
| X5 Stability | A9 | Run call 2 twice on the same cached sources | Same trait names for CMO in at least 80%; fit % within 10 points | L | if time allows |

Decision rule: X1 fails on personality, then types collapse behind "show working-style types" and only the read is visible. X1 fails on fit, then rename "Position fit" to "Must-have evidence coverage" with the % kept. X4 over budget, then call 2 moves to the verify model.

## 4. Pre-mortem: it is 2026-10-10 after judging, and we lost. Why?

### Tigers (real)

| ID | Risk | Evidence it is real | Class |
|---|---|---|---|
| T1 | **Jury reads DISC/MBTI + fit % as the out-of-bounds "personality score"** and docks value, honesty and originality at once | Brief "Out of bounds: Personality, credit or trustworthiness scores of a person". MBTI/DISC are personality typologies; a big % next to a person's name looks like a rating | Launch-blocking |
| T2 | **Personality built from other people's words or with no evidence** | `profile.ts` keeps DISC/MBTI types even when every personality quote failed the gate; only the read gets the "unsupported" suffix. Nothing checks the quote's source is authored by the subject; Buryan's feed has 2 reposts by other people | Launch-blocking |
| T3 | **Hallucinated or mismatched evidence** shown as FACT | Gate checks quote-in-excerpt, but `kind` is the model's label: a FACT tag on an inference passes. Excerpt is capped, so a true quote outside it drops and the item vanishes silently | Launch-blocking |
| T4 | **Fit % is unstable or gameable**: the model chooses traits each run, so the denominator moves | `position_fit` traits come from call 2 with no fixed list; two runs can show 62% and 80% | Launch-blocking (demo shows one number; a re-run in front of jury must not swing) |
| T5 | **Output truncation on a source-rich subject**, profile degrades to one muted line in the live demo | Adapter note: run 88538fed truncated at 8000 tokens; 32k set since. Buryan has 96 sources; call 1 asks for every job + education + projects with evidence arrays | Launch-blocking |
| T6 | **Cost per run over $0.50**: two primary-model calls with up to 60k chars prompt each, after extract/verify/synthesize | Actors alone were $0.15 for Buryan offline; posts actor is $0.06. Primary model is the expensive lane | Fast-follow (runner enforces the budget; risk is the profile step being skipped, which T5's degrade covers) |
| T7 | **Namesake leakage**: an election page, ArcelorMittal manager or trade-register entry becomes an achievement or risk | Buryan research found 6 same-name exclusions, one political (Art. 9 territory) | Launch-blocking for the political page; track for others |
| T8 | **Private accounts**: posts from a private Instagram leak into personality evidence | Scraper returned 2 posts from a `private: true` account | Fast-follow (collector must drop; check on demo subject) |
| T9 | **Risks phrased as judgements** ("job hopper", "overstates numbers") instead of checks | Risk prompt says "never a judgement", but nothing tests it; Buryan has 3 conflicting budget figures, an easy trap | Fast-follow |

### Paper tigers

| Concern | Why not real |
|---|---|
| GDPR: no consent from the subject | Brief: any person researchable from public data, no consent needed. Demo subject is a public professional with an active public profile |
| Art. 9 inference from DISC/MBTI | Personality typology is not health, politics, religion, ethnicity or sexuality. The real Art. 9 risk is namesake pages (T7), already filtered by `removed_protected` |
| "LLM-derived history is unreliable" | History entries must carry evidence quoted from LinkedIn experience text; the gate drops the rest. Self-reported dates are labelled, contradictions kept (Vilgain/Meta overlap) |
| Page too long | Caps and collapsed evidence keep the first screen short; long is fine below the fold |
| Recruiters will not trust AI-written summaries | Every line opens to a quote and a link; that is the product's answer and the core of the demo |

### Elephants

| Concern | Investigation |
|---|---|
| EU AI Act lists AI for recruitment and candidate evaluation as high-risk (Annex III). A jury member may ask | One honest line in README limitations: decision support, human decides, no automated rejection, evidence shown. Robert decides whether to say it in the video |
| Nobody has watched a recruiter use the page | X2 tonight; it is the only real user signal before freeze |
| The candidate never sees their profile (intake rule), yet it contains a personality read about them | Track. State in limitations; raw data purged after judging per brief |
| Second demo subject with thin public writing: does the page degrade well or look empty? | Run one thin subject (or the team member) and check E2 nulls and gaps text |

### Action plans for launch-blocking tigers

| Tiger | Mitigation | Owner | Due |
|---|---|---|---|
| T1 | Keep Robert's section, frame it: heading "Working style (inference)", disclaimer pill before types, types shown with confidence and evidence count, no colour scale. Fit renamed in copy to "evidence for must-haves", % explained inline ("4 of 6 must-haves evidenced, partial counts half"). README limitations names the brief rule and our framing. Run X1 | Claude (copy, UI), Robert (decision on X1 outcome) | 2026-10-09 22:00 |
| T2 | In `profile.ts`: null DISC and MBTI when surviving personality evidence < 3; accept personality evidence only from self-authored sources (own LinkedIn posts not reposts, about text, own X posts, own talk); test both | Claude | 2026-10-09 21:00 |
| T3 | Force `kind=INFERENCE` in code unless the claim it maps to is a verified FACT; log dropped-evidence count per section and show "N lines dropped by the quote check" in the section footer | Claude | 2026-10-09 23:00 |
| T4 | Freeze traits: derive from the role's ingested must-haves when present, else pass call 2 a fixed list; show trait count in the fit line; X5 if time | Claude | 2026-10-10 01:00 |
| T5 | X4 live run; if `degraded`, split call 1 (achievements+risks / history) or halve the source block on retry; degraded line names the reason | Claude, Robert runs live | 2026-10-10 02:00 |
| T7 | Assert in a test that sources dropped as namesakes or protected never appear in profile evidence; check the Buryan page for kurzy.cz, aist.org, rejstrik | Claude | 2026-10-09 23:00 |

Code freeze is at sunrise 2026-10-10; anything not done by 04:00 is cut, not rushed.

## 5. Page spec (compact)

Order is fixed by Robert: 1 Achievements, 2 Risks, 3 History, 4 Personality profile, 5 Position fit %, 6 What to ask.

### What the recruiter scans first (above the fold)

1. Name, headline quote, location, confirmed-profile badges (existing header).
2. Verdict line: role, fit % with "n of m must-haves evidenced", count of risks, count of questions. Plain text, no colour judgement.
3. First 3 achievements, then first 3 risks, both visible without scrolling on a laptop.

### Per-section rules

| # | Section | Visible before "show more" | Row content | Notes |
|---|---|---|---|---|
| 1 | Achievements | 3 | One sentence, numbers kept, evidence chip | Self-reported numbers say so ("per their LinkedIn") |
| 2 | Risks | 3 | Stated as a check, never a verdict; conflict marker when any line weakens | Contradictions (budget $150M/$175M/$200M) are risks to ask about |
| 3 | History | 5 jobs; education, projects, volunteering behind "show more" | Org, title, dates as written, one-line summary | Overlaps and gaps flagged as text (Vilgain/Meta 2022) |
| 4 | Personality profile | Disclaimer pill, DISC type + confidence, MBTI type + confidence, read (max 3 sentences) | Types null under the evidence floor: "Not enough of their own writing to suggest a type" | Muted card, never the largest text |
| 5 | Position fit % | Run's role only; adjacent roles behind "show more" | Bar + %, "n of m evidenced", trait list with has / partial / none | % computed in code, formula one click away |
| 6 | What to ask | 5 | Question + "closes: <risk or gap>" | Each links back to its risk |

### Evidence accordion (every item)

- Collapsed by default. Summary reads "Evidence (N)", plus "1 weakens" in conflict colour when any line weakens.
- Each line: verbatim quote, FACT or INFERENCE pill, "supports" or "weakens", source link deep-linked at the quote, retrieved date.
- Unknown source id renders "source missing", never a blank link.
- No item renders with zero evidence, except the personality read, which then carries the unsupported suffix.

### Labelling rules for personality and fit

- Personality card first line: "Inference from public writing, not an assessment of the person."
- Sources for personality: only what the person wrote or said themselves. Reposts and press about them are excluded.
- Fit card first line: "Share of the role's must-haves with public evidence. Not a rating of the candidate."
- No colour scale (red/green) on fit %, no ranking between candidates, no word like "score", "rating", "trust", "culture fit".
- Confidence is shown as a word (low / medium / high), never a number.
- Nothing in either card touches health, politics, religion, ethnicity or sexuality, even indirectly.

### QA checklist for the Buryan page

| # | Check | Pass when |
|---|---|---|
| 1 | Order | Six sections appear in Robert's order; empty ones are omitted, not shown blank |
| 2 | Evidence integrity | Every evidence quote is found in its source excerpt and the link opens a page containing it (sample 10) |
| 3 | Reposts | The "Three years ago I joined Groupon from Slevomat" repost appears nowhere as their achievement or personality evidence |
| 4 | Namesakes | No line cites kurzy.cz, programydovoleb.cz, aist.org (ArcelorMittal), rejstrik.penize.cz or OpenAlex records |
| 5 | Private accounts | No evidence from Instagram posts or TikTok; Instagram bio only, if anywhere |
| 6 | Contradictions | Vilgain/Meta 2022 overlap and the budget figures appear as risks or weakens lines, both readings kept |
| 7 | History | Seven jobs Feb 2025 back to Aug 2011, dates as LinkedIn writes them; education and volunteering behind "show more" |
| 8 | Personality | Disclaimer visible; types have confidence; every quote is their own writing; types null if under 3 quotes |
| 9 | Fit | % equals has 1 / partial 0.5 / none 0 over the listed traits by hand calculation; label says must-haves, not rating |
| 10 | Questions and cost | At least 3 questions each closing a named risk or gap; run cost in the ledger under $0.50 and `degraded` is null |
