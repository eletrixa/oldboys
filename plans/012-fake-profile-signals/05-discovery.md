# Discovery + brainstorm — profile authenticity signals

Output of `pm:discover` and `pm:brainstorm` (existing product, continuous discovery), 2026-10-09. Research pack: [01-deep-dive.md](./01-deep-dive.md) §Signals.

## Context

- **Product**: oldboys hiring report. Input = confirmed LinkedIn profile or CV plus role. Output = sourced claims, FACT split from INFERENCE, gaps named, namesakes handled.
- **Opportunity**: "a fake account would be a red flag at the profile" (Robert). Two distinct jobs hide in that sentence:
  1. **Impersonation around the candidate**: a profile that borrows the candidate's name, photo or bio (someone pretending to be them) or, the reverse, the candidate's profile borrowing someone else's photo.
  2. **Fabrication on the candidate's own profiles**: an account too young for the career it describes, bought followers, employers that do not exist, a GitHub made of forks and empty repos.
- **What we already know** (research pack): humans catch 18% of impersonators (Goga, IMC'15); single-account classifiers generalise badly (34% TPR at 0.1% FPR); pair signals (same name + same photo or bio on two accounts) are the strongest; photo detectors give ~1% false positives on real people and miss diffusion images; Gartner expects 1 in 4 candidate profiles fake by 2028; the FBI's DPRK checklist is profile-vs-resume mismatch, several profiles with different pictures, reused photos, no picture, young accounts.
- **Product constraints that shape everything**: no personality or trustworthiness score (brief); `JUDGEMENT` regex already forbids "fake", "suspicious", "fraud" in claims and challenge reasons (`src/domain/challenge.ts`); FACT needs a quote in an excerpt; budget $0.50 and 16 paid actor runs per run; GDPR Art. 9 means no face biometrics.
- **Decision this discovery informs**: which signals to compute first, from which data, and how to present them without a verdict.

## Ideas (PM / Designer / Engineer)

### Product manager
1. **Account-age vs career-age mismatch** — "profile created 2025, first role 2012". Public, deterministic, the FBI's own signal. Impact H, effort L (X/GitHub carry `createdAt`; LinkedIn creation year is login-gated).
2. **Employer existence check** — every employer on the confirmed LinkedIn profile looked up in ARES (CZ) and in LinkedIn company pages; "no company of that name registered" is a question for the interview, not a verdict. Impact H, effort M (ARES adapter exists for due-diligence).
3. **Doppelganger lineup** — in the identity lineup, a rejected or possibly-same-as candidate that shares name AND photo or bio with the confirmed profile is labelled "shares photo / bio with the confirmed profile" (Goga's pair test). Impact H, effort M.
4. **Profile-vs-CV mismatch already exists** (`cv-consistency`); extend it to profile-vs-profile (LinkedIn headline vs GitHub bio vs X bio). Impact M, effort L.
5. **Reused-photo check** — reverse image search of the confirmed avatar; hits under other names on unrelated domains are listed as sources. Impact M, effort M, costs money and has legal weight.

### Designer
6. **"Profile signals" card, not a score** — one card per confirmed profile with plain sentences and a source link each: "Joined X in 2025-08 · 12 followers · follows 1 840". No colour verdict; the recruiter reads and decides. Impact H, effort L.
7. **Interview questions, not accusations** — every mismatch becomes a question in the existing interview kit ("Your LinkedIn shows X since 2012; the account was created in 2025. Could you walk us through it?"), reusing the `cvInterviewQuestion` style. Impact H, effort L.
8. **"Not checked" honesty lines** — when LinkedIn creation date is not public or the budget was exhausted, say so, like `not_searched`. Impact M, effort L.
9. **Devil's advocate ground "young source"** — the challenge card gets a fifth ground: a FACT quoted only from an account younger than N months is moved to "verify at the interview". Impact M, effort L.
10. **Czech copy parity** — the card goes through the same i18n path as the rest of the report. Impact M, effort L.

### Engineer
11. **Signals from payloads we already pay for** — X (`followers`, `createdAt`), Instagram (`followersCount`, `followsCount`, `postsCount`, `verified`), GitHub (`created_at`, `followers`, fork share from `github_deep`), TikTok/YouTube counts: compute in each collector's `digest` (the `github_deep` pattern), zero extra I/O. Impact H, effort L.
12. **Cross-profile signals at read time** — the state loader merges per-step digests and computes pair signals (bio near-duplicate via `nearDuplicate`, name+photo-hash equality) in `src/domain`, pure and testable. Impact H, effort M.
13. **Avatar perceptual hash** — fetch the avatar bytes once per confirmed profile (free REST fetch), compute a pHash in the Worker, compare across profiles and against lineup rejects; no third party, no biometrics (hash of pixels, not a face template). Impact M, effort M. Legal: still a photo of a person, but no biometric processing (see 02 §Legal).
14. **Reverse image search as an optional paid step** — Apify `thodor/google-lens-exact-matches` ($0.80/1000) behind an env flag; results are Sources ("also found under another name on example.com"). Impact M, effort M, must fit the 16-actor cap.
15. **AI-generated photo detector as INFERENCE only** — Sightengine free tier (2 000 ops/month) returns a probability; shown as "detector score 0.93, detectors miss diffusion images and misfire on ~1% of real photos", never as a FACT. Impact L–M, effort L, legal yellow.

## Top 5 (selected to carry forward)

| Rank | Idea | Why | Quick win |
|---|---|---|---|
| 1 | 11 + 6: per-profile signals from existing payloads, shown as sentences with source links | Zero new cost, deterministic, quotable, matches the honesty rubric | Yes |
| 2 | 1 + 7 + 9: account-age vs career-age mismatch as an interview question and a challenge ground | The one signal every authority (FBI, Goga, Pindrop) lists; uses data we have | Yes |
| 3 | 3 + 12: doppelganger pair signals in the lineup (name + bio/photo shared) | Pair signals are the only ones with published precision (90% TPR at 1% FPR); fits the existing identity map | Medium |
| 4 | 2: employer existence via ARES / LinkedIn company | Turns "fake employer" from a gut feeling into a source link | Medium (budget: free REST) |
| 5 | 13 → 14: avatar pHash now, paid reverse image search later behind a flag | Cheapest route to the photo-reuse signal; the paid route is a flag flip once legal is settled | Medium |

Dropped for v1: 15 (AI-photo detector: ~1% FPR on real people, misses diffusion, Art. 9 adjacent), 5 as default (cost and GDPR purpose-limitation questions; keep as flag).

## Assumptions (devil's advocate, four risk areas)

| # | Assumption | Area | Could go wrong | Confidence | Test |
|---|---|---|---|---|---|
| A1 | Recruiters want authenticity signals per profile, not a single "fake score" | Value | They skim and want one number; sentences feel like homework | M | Show the card to 3 recruiters on 3 demo subjects; count whether they ask "so is it fake?" |
| A2 | The signals we can compute from existing payloads are discriminative enough to matter | Value | Every legit Czech candidate has 40 X followers and a 2023 GitHub; the card becomes noise | M | Run on the 3 demo subjects + 2 known-good peers: no signal should fire on all of them |
| A3 | Sentences without a verdict are read as a red flag when they should be | Usability | Recruiter misses "created 2025" buried among numbers | M | Order signals by salience; a "worth asking" subset at the top; 5-second test |
| A4 | Interview-question framing keeps us clear of "trustworthiness score" (brief hard rule) | Viability | A judge reads "account created 2025, follows 1 840" as a score in disguise | H | JUDGEMENT screen on every sentence; copy review against brief §hard rules |
| A5 | Account creation dates are available in the payloads (X `createdAt`, GitHub `created_at`); LinkedIn's is login-gated | Feasibility | harvestapi returns no creation year; the top signal is empty for LinkedIn | H | Inspect one stored R2 payload per actor (spike, 30 min) |
| A6 | Avatar bytes are fetchable from the Worker without login (LinkedIn CDN URLs expire; Instagram blocks) | Feasibility | pHash signal empty for the main platforms | L | Spike: fetch avatar URLs from 3 stored payloads; measure 200 vs 403 |
| A7 | pHash of an avatar is not biometric processing under Art. 9 | Viability | Legal reads any face comparison as biometric | M | Written note from counsel; until then keep pHash comparison but never a face model |
| A8 | ARES lookup for employers stays within the free-REST budget and the 45s step cap | Feasibility | 8 employers × ARES = slow step | H | Count employers on demo profiles; cap at 6 |
| A9 | Reverse image search of a candidate's photo is lawful for pre-employment screening (purpose limitation, Art. 6(1)(f)) | Viability | Czech ÚOOÚ or a judge flags it | L | Keep off by default; legal note in 02 §Legal; flag `PHOTO_SEARCH=off` |
| A10 | Impersonation of the candidate is common enough to be worth a lineup label | Value | Never fires on demo subjects, judges never see it | M | Seed one demo subject with a known namesake sharing a bio line; verify the label renders |

## Prioritised assumptions (Impact × Risk)

- **Leap of faith (high impact, high uncertainty)**: A2 (signals discriminate), A5/A6 (data actually present), A7/A9 (legal shape of photo work).
- **High impact, low risk → build**: A4 (framing), A8 (ARES budget), A3 (salience ordering).
- **Defer**: A1, A10 (observe after launch).

## Experiments

| # | Tests | Method | Success criterion | Effort | When |
|---|---|---|---|---|---|
| E1 | A5, A6 | Spike: read one stored R2 payload per platform actor; list which authenticity fields exist; try fetching 3 avatar URLs from `wrangler dev` | ≥3 platforms expose creation date or follower pair; ≥1 platform's avatar fetch returns 200 | 1 h | Before building (feeds 03-options) |
| E2 | A2 | Run the signals domain function on the 3 demo subjects + 2 known-good peers | No single signal fires on all 5; at least one subject with a "worth asking" line | 1 h after v1 | Same day |
| E3 | A4 | Copy review: every signal sentence through `JUDGEMENT` + ACCUSATION screen in a unit test | 0 violations | 15 min | With the tests |
| E4 | A10 | Fixture: a namesake candidate whose snippet repeats the confirmed headline | Identity map shows "shares headline with the confirmed profile" | 30 min | With the tests |
| E5 | A7, A9 | One paragraph from counsel (or Robert's call) on pHash and reverse search | Written yes/no; until then flags stay off | async | Before enabling photo search |
| E6 | A1, A3 | 5-second test with 2 recruiters on the card | Both name the top signal within 5 s | 20 min | Post-launch |

## Decision framework

- E1 shows creation dates on ≥2 platforms → build option with per-collector digests (see 03-options).
- E1 shows avatars are not fetchable → drop pHash from v1, keep the lineup bio/name pair signal only.
- E2 fires a signal on all 5 subjects → the threshold is wrong; raise it before the UI ships.
- E5 says no → `PHOTO_SEARCH` and avatar fetch stay out of the recipe; the plan's photo items move to "deferred".

## Next

03-options and 00-SYNTHESIS pick the architecture; 06-pre-mortem lists the tigers.
