# Deep dive — codebase and detection signals

Date 2026-10-09. Codebase facts are from reading `/home/asajj/code/oldboys` at commit 84e0406 (origin/main) and from the steelman court (04 §Facts). Research facts carry a URL; the raw notes are in the session scratchpad (research-fake-detection.md, research-tools-cases.md) and are condensed in 02.

## Codebase: the seams a signal can use

| Surface | What it is | Pointer |
|---|---|---|
| Collector contract | `requests()`, `parse()`, optional `followUp()`, optional `digest(payloads, ctx)`; pure, no I/O | `src/recipe/sources/types.ts` (`Collector`, `StepOutcome.digest`) |
| Digest to ledger | `collectWith` calls `collector.digest`, the Workflow writes it as `ref.digest` in the step's ledger row | `src/recipe/runner.ts:153`, `src/workflow/research-run.ts:232` |
| Digest read-back | `readCodeProfile(rows)` parses the newest `ref.digest` of `github_deep` defensively, null for older runs | `src/domain/code-profile.ts` (`readDigest`) |
| State route | `code_profile: readCodeProfile(ledger.results)` next to candidates, claims, challenges | `src/app/api/runs/[id]/state/load.ts:153`, `src/app/runs/[id]/state.ts:70` |
| Card + kit | `CodeProfileCard` after `BriefView`; `codeProfileLines` section in the interview kit | `src/app/runs/[id]/run-view.tsx:238`, `interview-kit.ts:217` |
| Identity gate | `identityFor(ctx, url)` is "merged" only under a merged candidate's profile url or handle | `src/recipe/sources/types.ts` |
| Seed seam | Profile-first runs scrape the manager's LinkedIn URL in `seedProfile` via `harvestRequest`/`harvestProfiles`, outside any collector; its ledger ref is built by hand in `seedStep` | `src/recipe/seams/seed.ts:89-101`, `src/workflow/research-run.ts:248-260` |
| Lineup | `resolve` drafts candidates from profile-like sources, scores them (model, deterministic fallback), caps name-only hits at possibly-same-as; `Candidate.reasons` and `snippet` are professional-only | `src/recipe/seams/resolve.ts` |
| Judgement screen | `JUDGEMENT` forbids fake, lie, inflated, dishonest, suspicious, fraud, fabricated, untrustworthy; ACCUSATION adds cheat, plagiarise, steal, mislead, misrepresent, pretend, deceive, exaggerate, bogus, scam; applied to challenge reasons and `cv-consistency` claims only | `src/domain/challenge.ts:52-54`, `src/recipe/seams/verify.ts:156` |
| Devil's advocate | Four grounds; eligible = must-have FACTs; `forkPrecheck` is the deterministic precedent | `src/domain/challenge.ts` |
| Near-duplicate text | `nearDuplicate` = folded equality or token Jaccard ≥ 0.8; `tokens` | `src/domain/similar.ts` |
| Fetch port | `fetchJson` only: JSON bodies, 20 s, 160-char error note; no bytes | `src/adapters/fetch.ts` |
| Budget | $0.50 and 16 paid actor runs, enforced in the runner; free REST counts USD only | `src/recipe/runner.ts:270-277` |

### What each payload already carries (zod schemas before this plan)

| Collector | Fields parsed today | Fields the actor returns but the schema dropped |
|---|---|---|
| `harvestapi/linkedin-profile-scraper` | name, headline, location, experience (title, company, start, end), education, skills count | `photo`, `verified`, `premium`, `openToWork`, `connectionsCount`, `followerCount`, `about` (actor README, fetched 2026-10-09) |
| `apidojo/tweet-scraper` | author `userName`, `name`, `description`, `followers`, `createdAt` | `following`, `profilePicture`, `isBlueVerified` (ASSUMPTION from the actor's dataset docs) |
| `apify/instagram-profile-scraper` | `followersCount`, `followsCount`, `postsCount`, `verified`, `biography`, `externalUrl` | `profilePicUrl`; join date only via a paid add-on |
| `clockworks/tiktok-profile-scraper` | `authorMeta.fans`, `signature` | `following`, `avatar` (ASSUMPTION) |
| `rest/github` user | `followers`, `created_at`, `bio`, `company`, `location`, `public_repos` | `following`, `avatar_url` |
| `rest/github-deep` | `CodeProfile`: `repos_owned`, `forks_excluded`, `account_created`, events, orgs | none needed |
| `rest/bluesky` searchActors | `handle`, `displayName`, `description` | `followersCount`, `followsCount`, `postsCount`, `createdAt`, `avatar` |
| `streamers/youtube-scraper` | video title, channelName, viewCount | `numberOfSubscribers` (ASSUMPTION) |

Consequence: creation dates exist for X, GitHub and Bluesky; counts for all; LinkedIn has `verified`, connections and followers but no creation date without login.

## Detection signals: what the literature supports

Ordered by strength of evidence.

1. **Pair signals (same name plus shared photo, bio or location on two accounts).** Goga, Venkatadri, Gummadi, "The Doppelgänger Bot Attack", IMC 2015: crowd raters judged 4% of loose, 43% of moderate and 98% of tight matches the same person; an account-pair classifier reached 90% TPR at 1% FPR; a single-account classifier 34% TPR at 0.1% FPR; humans spotted 18% of impersonators; impersonator accounts were created after the victim's and had lower reputation. https://www.lix.polytechnique.fr/~goga/papers/impersonators_IMC2015.pdf
2. **Account age and numeric profile features.** "Weak Links" (2025): 17 numeric features (job count, education entries, skills, connection stats) resist adversarial text better than embeddings; humans F1 58.9%. https://pith.science/paper/2507.16860 . Pindrop: fake applicants' e-mails first seen 48 days earlier vs 1 646 days for good ones. https://www.pindrop.com/article/north-korean-it-worker-alert-hiring-fraud/
3. **FBI IC3 PSA (2025-01-23)**: profiles that do not match the résumé; several profiles with different pictures; reused photo across identities; no picture; empty or boilerplate GitHub repositories. https://www.ic3.gov/psa/2025/psa250123
4. **GitHub**: StarScout (2024) flags accounts with trivial activity, forks-only and coordinated starring. https://arxiv.org/abs/2412.13459 ; DPRK personas use reused matured accounts, generic repo names, copied company repos. https://nisos.com/blog/dprk-github-employment-fraud/
5. **Platform self-disclosure**: LinkedIn "About this profile" (creation year, last update, verification) is login-gated; X "About this account" shows creation date, region, username changes. LinkedIn stopped ~197M fake accounts in 2025, 115M+ members verified. https://about.linkedin.com/transparency/community-report
6. **Photo detectors (weak, risky)**: LinkedIn's GAN detector 99.6% TPR at ~1% FPR, no generalisation to diffusion; 2024 follow-up 84.5% recall on unseen generators. https://www.linkedin.com/blog/engineering/trust-and-safety/new-approaches-for-detecting-ai-generated-profile-photos . Meta: behavioural signals beat photo-only detection. https://www.cbsnews.com/news/is-that-facebook-account-real-meta-reports-rapid-rise-in-ai-generated-profile-pictures/
7. **Vendor-grade engagement ratios (Instagram/TikTok)**: not peer reviewed; follow-heavy ratios and round-number jumps. Weak; used only as the conjunctive `follow-asymmetry` rule.

Thresholds in 00-SYNTHESIS (180 days, 365 days, 10× with ≥ 500 following, 80% forks over ≥ 5 repos, < 50 connections with ≥ 5 career years, ≥ 6 headline tokens at Jaccard 0.8) follow the direction of these sources, not a calibrated cut-off: ASSUMPTION, gated by experiment E2 (05).

## Tools and prices (for the evolution path only)

| Tool | Use | Price | Source |
|---|---|---|---|
| Apify `s-r/google-lens` | reverse image, visual matches | $0.005 per image with a match + $0.002 start | https://apify.com/s-r/google-lens |
| Apify `thodor/google-lens-exact-matches` | exact matches with pHash confidence | $0.80 / 1 000 | https://apify.com/thodor/google-lens-exact-matches |
| SerpApi `google_lens` | same, HTTP | 250 free / month, then $25 per 1 000 | https://serpapi.com/google-lens-api |
| Sightengine `genai` | AI-generated image probability | 2 000 ops / month free (≈ 400 checks), $29 per 10 000 | https://sightengine.com/pricing |
| TinEye | exact copies | $0.04 per search, no free tier | https://blog.tineye.com/new-image-search-pricing/ |
| Bing Visual Search | retired 2025-08-11 | n/a | https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement |
| Apify `scrapesage/maigret-scraper` | username across 1 490 sites | $2.20 per 1 000 accounts found | https://apify.com/scrapesage/maigret-scraper |

## Legal shape (not legal advice)

WP29 Opinion 2/2017: screening applicants' social media needs a legal ground, necessity, proportionality and prior information; only job-relevant data. Czech ÚOOÚ guidance (secondary source) tolerates professional networks and requires informing the applicant. Reverse image search of a public avatar is personal-data processing under Art. 6(1)(f) with an Art. 14 notice; face templates are Art. 9 biometrics (EDPB Guidelines 05/2022 reasoning; PimEyes enforcement). A pixel pHash is not a face template but still processes the photo. v1 therefore reads only numbers and text the platforms publish; any photo step waits for a written note in `docs/ops/`. Sources in 02 §Legal.

## Negative results

- No source gives thresholds for connection counts, "500+", "open to work", or GitHub commit-e-mail mismatch.
- No maintained production LinkedIn fake-profile detector found; Botometer is tied to the pre-2023 X API.
- LinkedIn creation date is not available without login from any actor checked.
- Hugging Face AI-image detectors (`Organika/sdxl-detector`, `umm-maybe/AI-image-detector`) are non-commercial or trained on art, not headshots.
