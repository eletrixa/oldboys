# Pre-mortem — profile authenticity signals

Output of `pm:pre-mortem`, 2026-10-09. Status: Draft. Imagined: the feature shipped today, and by the demo it hurt us.

## Risk summary

- Tigers: 7 (3 launch-blocking, 2 fast-follow, 2 track)
- Paper tigers: 4
- Elephants: 3

## Launch-blocking tigers

| # | Risk | Likelihood | Impact | Mitigation | Owner | Deadline |
|---|---|---|---|---|---|---|
| T1 | **A signal fires on every real candidate.** Czech professionals typically have a 40-follower X account and a 2022 GitHub; "young account" and "low followers" lines appear on all 3 demo subjects and the card reads as a smear of normal people. | High | Judges score honesty down; recruiters distrust the report | Thresholds are *relative*: account age vs earliest experience year on the confirmed profile (not vs today); follower ratios only when following ≥ 10× followers AND following ≥ 500; followers alone never a signal. E2 in 05: no signal may fire on all 5 test subjects. | this plan | before UI |
| T2 | **The card becomes a trustworthiness score in disguise** (brief hard rule, judge criterion "honesty 10"). A coloured badge, a count ("3 red flags"), or the word "fake" anywhere. | Medium | Disqualifying for the brief's hard rule | No colour, no count, no verdict word; every sentence passes the `JUDGEMENT` + ACCUSATION screens in a unit test; title "Profile signals", eyebrow "What the public accounts show". The devil's advocate may only move FACTs to the interview, never label the person. | this plan | with tests |
| T3 | **Impersonation label harms a real third person.** A namesake in the lineup labelled "shares bio with the confirmed profile" is a real other person whose report row now looks like an impostor. | Medium | Legal and ethical harm; brief says namesakes handled | Pair label only when name AND (near-duplicate bio OR identical photo hash) match (Goga tight scheme), wording describes overlap ("same headline text as the confirmed profile"), never "impersonates". Rejected candidates stay rejected; the label never changes a decision. | this plan | with tests |

## Fast-follow tigers

| # | Risk | Likelihood | Impact | Planned response | Owner |
|---|---|---|---|---|---|
| T4 | **LinkedIn facts are thin.** Creation year is login-gated; harvestapi gives `verified`, `connectionsCount`, `followerCount`, `premium`, `openToWork`, `photo`. The top signal (account age) is empty for the platform that matters most. | High | Card says less than hoped for LinkedIn | Use what is public: LinkedIn `verified` badge (from the actor), connections vs years of career, headline vs GitHub/X bio consistency; state "LinkedIn does not publish the creation date without login" as a not-checked line. | this plan |
| T5 | **Signals miss the Czech brief and `Brief.sections`** when computed at read time (Option A). | Medium | Translated report lacks the card | Synthesize seam reads the same domain function and adds a section; translation covers sections already. | fast follow |

## Track tigers

| # | Risk | Trigger to act |
|---|---|---|
| T6 | Payload shapes drift (actor updates rename `createdAt`); digests silently go null and the card disappears without a gap line. | State route logs `profile_signals: null` while platform steps succeeded; add a "not available from this source" line per platform instead of silence. |
| T7 | A future photo step (pHash / Lens) is enabled without a legal note; WP29 2/2017 and ÚOOÚ say screening must be relevant and announced. | Flag flips before `docs/ops/profile-signals.md` has the legitimate-interest note and the candidate notice text. |

## Paper tigers

- **"We need an AI-image detector or it is not real fake detection."** LinkedIn's own detector misses diffusion images and Meta says behavioural signals beat photo-only detection; a 1% FPR on real headshots is a thousand smeared people per 100k. Deterministic account facts are the honest v1; the detector is a flagged v2 at best.
- **"Reverse image search is too expensive."** Apify Google Lens costs $0.005 per matched image; the blocker is legal shape and CDN 403s, not price.
- **"Touching 8 collectors is a big diff."** Each `digest()` is 5 to 15 lines mapping already-parsed fields; the pattern exists in `github-deep.ts` and is tested from stored fixtures.
- **"Recruiters will not read sentences."** The interview kit already turns CV differences into questions and that card tested fine; the signals reuse the same shape (05 E6 verifies).

## Elephants

- **The feature cannot detect the fraud that actually scares companies.** The DPRK cases passed background checks with stolen real identities and AI-edited real photos; public-profile signals catch sloppy fakes, not state actors. Say so in the card's caveats and in the demo script, or a judge will say it for us.
- **We have zero labelled fakes to test against.** Every threshold is set from literature, not from our own data; the eval set has no positive example. Add one synthetic fixture per rule and one real-world namesake pair, and write "thresholds from literature, untested on Czech data" in the plan's assumptions.
- **GDPR purpose limitation of the whole product is unsettled**, not only the photo part. ÚOOÚ guidance restricts social-media lustration of applicants to professional networks unless announced; this feature widens what we look at on Instagram and TikTok. The plan should name the candidate-notice text as a dependency, not pretend the question belongs to photo search alone.

## Go / no-go checklist

- [ ] T1: thresholds relative, E2 passed on 5 subjects (no rule fires on all)
- [ ] T2: screen test green over every sentence template; no colour, count or verdict in the card
- [ ] T3: pair label requires two matching attributes; wording reviewed
- [ ] T4: LinkedIn not-checked line present
- [ ] Rollback: the card renders nothing when `profile_signals` is null or absent (older runs keep working)
- [ ] Caveat lines: public data only, state-actor fraud not covered, thresholds from literature
