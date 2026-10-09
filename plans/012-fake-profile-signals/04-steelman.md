# Steelman court — Advocate vs Prosecutor per option

## Option A: Read-time signals from collector digests

### Advocate

1. **Proven pattern, zero risk.** `Collector.digest` exists (`src/recipe/sources/types.ts:70`); runner writes it to ledger ref; `readCodeProfile` reads defensively; state route returns `code_profile`. No Workflow or budget change. ($0, ~1 day)

2. **Data already paid, quotable.** X, Instagram, GitHub already print joined dates and followers in excerpts. Only $0 per run versus Option B's 45 s step.

3. **Every sentence has a rule.** `JUDGEMENT` regex at `challenge.ts:52` screens output. `codeProfileCaveats` shows house style. Answers "where is the rule?"

4. **Targets published signals.** Account age versus career is on every authority list. Pair signals: 90% TPR. Avoids photo detector (1% false positives) and face model (Art. 9).

5. **Cheap to be wrong.** One day. Exit is one domain file, eight functions. Option B's step later "just writes more `ProfileFacts`" without touching v1.

### Prosecutor

1. **Headline signal has no data on key platforms.** LinkedIn creation year login-gated; schema omits it. Instagram has no joined date. Only X and GitHub carry dates, platforms recruiters care least about.

2. **Central profile never passes through collectors.** Scraped in seed seam at `src/recipe/seams/seed.ts:33,89,101`, not through `collect`. Adding `digest()` to eight collectors misses the one profile every run starts from.

3. **Digests ignore identity, mark namesakes.** Instagram collector requests "merge" or "possibly-same-as" candidates. A possibly-same-as namesake yields `ProfileFacts` under the candidate. Pair signals on namesakes: 4% same-person. Fix needs per-signal identity gating, unspecified.

4. **Fires on everyone, no calibration.** Pack names sparse profiles, new graduates, career changers as false-positive traps. Czech engineer with 40 followers triggers both lines. A2/E2 unrun.

5. **Bypasses verify, honesty guarantee.** Card in `state.ts` bypasses `verify`, Art. 9 screen, claim ledger, translate route. Czech report omits the section. Judge asking for quote and verify record gets "derived number in digest".

### Concessions

LinkedIn creation year login-gated. Signals miss Czech translation. No employer/photo signals in v1.

### Cross-examination

**Advocate's strongest:** Repo already runs `Collector.digest` defensively; proven pattern. **Prosecutor:** But central LinkedIn is in seed, bypassing collectors. Adding digest to eight while missing the ninth is incomplete.

**Prosecutor's strongest:** Card bypasses verify, Art. 9, ledger, violating honesty contract. **Advocate:** Card prints caveats. Small synthesize read is known extra. Signals stay out of FACT/INFERENCE to block accusations.

---

## Option B: `profile_signals` step with REST I/O

### Advocate

1. **Source pipe exists; Sources reach claims.** Collectors return `ParsedSource`; `extract` reads identity-merged sources, reaching claims, verify, brief, translation, kit. `github_deep` proves this pattern. Option A concedes signals "absent from Czech translation."

2. **Produces FACTs where evidence supports them.** FACT needs quote inside excerpt. "ARES returned 0 subjects" is quotable from public register. `ares.ts` is reusable, free, no key. Judge gets URL and excerpt. (~2 days, $0 by default)

3. **Cost provably safe.** Free REST fetches count USD only. ARES is ~6 fetches under 1 s each. Lens $0.005 per match, behind `PHOTO_SEARCH` (off by default). Far under $0.50 caps.

4. **Extends recipe as intended.** `Collector` is pure. ARES parsing and `PHOTO_SEARCH` are unit-testable. New step is one line. Exit cost is deleting that line. Goal-delta widened.

5. **Only option judges see work.** "This employer is not in ARES" with link. Pair signals beat single-account (90% vs 34%, Goga). FBI checklist lists reused photos. Signals describe sources, not people.

### Prosecutor

1. **Claims pipe rejects what B puts in.** `collectWith` never writes `out.claims`. `verifyClaims` keeps only `confirmedSources` (merged). ARES hits "unverified"; Lens hits are strangers' pages. Claims citing them drop as "(no source)". Fix corrupts identity rule.

2. **Avatar fetch doesn't fit ports.** Only port parses JSON. Bytes need new port. Harvest has no photo field. CDN URLs block bots; assumption A6 is L-rated, spike E1 unrun. Decoding JPEG needs library (forbidden).

3. **GDPR: ships before legal answer.** E5 says "no" means no photo work. B fetches and hashes unconditionally; only Lens flagged. E5 and A7 unresolved. Lens sends photos to Apify and Google (no DPA).

4. **ARES wrong oracle.** Fabricators use real names. Schema keeps only company name, no country. Miss is ambiguous. `obchodniJmeno` returns substring hits; fuzzy matching forbidden.

5. **Budget timing off.** Hiring has 4 SERP + 7 paid steps (~12 of 16 runs). B sits late, skipped on busy runs. A's digests carry best signal (account age). B's extras are noise and unspecified hash.

### Concessions

Claims don't from step; excerpts are evidence. `fetchJson` JSON-only; bytes need port. CDN 403s named as `not_searched` (honesty mechanism). GDPR uncertain; ship ARES first. Hiring header forbids ARES; needs amendment.

### Cross-examination

**Advocate's strongest:** github_deep proves Sources reach claims if created correctly. **Prosecutor:** But `verifyClaims` only keeps merged sources. Third-party pages aren't merged; merging corrupts identity. ARES also wrong—fabricators use real names; no country context.

**Prosecutor's strongest:** No photo field; CDN 403s; GDPR unconfirmed, Lens sends to new recipients. **Advocate:** Ship ARES first; bytes later. Step names `not_searched` (honesty). pHash is pixel hash, not face template. Flags gate work until E5 answered.

---

## Option C: Model-derived signals via existing seams

### Advocate

1. **Copies shipped cv-consistency precedent.** Base question, extract rule, `JUDGEMENT` screen, interview question. Shipped and tested. C is second instance of proven pattern. (Hours, $0.00x)

2. **Least code.** One question in `hiring.ts` array, no step. Exit is deleting one question. A costs ~1 day + 8 functions; B costs ~2 days.

3. **Quotes make it FACT-grade.** Extract demands verbatim quote; verify drops FACT without quote in excerpt. "Joined 2025-08" quoted becomes verified FACT; "does not fit career" stays INFERENCE.

4. **Reaches e2e today.** E2e carries 20 pts. A and B risk half-built card at T+5h. C reaches report same day, covered by existing screens.

5. **Stages into A or B.** C can be replaced signal by signal. Starting with C gives kit real "worth asking" lines.

### Prosecutor

1. **Pipeline doesn't exist for these claims.** `challengeEligible` takes only FACTs with `mh-*` or `cv-consistency` ids. Profile-signals claim never challenged. `JUDGEMENT` screen gates on `CV_QUESTION_ID` only. Model may write "fake", "inflated" unchecked.

2. **Extract prompt forbids the feature.** Prompt says "claims about subject, never sources." Account-age is claim about source. Adding question breaks prompt or model skips it.

3. **No arithmetic, no thresholds.** Model must subtract years, compare to `earliest_experience_year`, decide "fits/not". No threshold table. Answer to "where is rule?" is "the model".

4. **Pair signals impossible.** `confirmedSources` drops rejected profiles. Strongest signal is pair (90% TPR). C produces single-account (34% TPR).

5. **Eval unmeasurable.** `pnpm eval` replays recorded answers. No rule to measure. Two fresh runs disagree. CACHED replay differs from live.

### Concessions

Non-deterministic. LinkedIn creation year login-gated, hurts all equally.

### Cross-examination

**Advocate's strongest:** Copies proven cv-consistency; hours vs 1-2 days; quotes become FACTs. **Prosecutor:** `JUDGEMENT` gates on `CV_QUESTION_ID` only. Extract forbids source claims. No thresholds; results vary.

**Prosecutor's strongest:** Rejected excluded, so pairs impossible; single-account weak (34% vs 90%). **Advocate:** That's Option D (impersonation). C covers fabrication. Pair demand unproven (A10), deferred. C stages later.

---

## Option D: Pair signals in identity lineup only

### Advocate

1. **Only published precision.** Goga: pair 90% TPR, single 34% TPR. A and B use single-account with no precision data. D has smallest unvalidated leap. (Half day, $0)

2. **Answers impersonation exactly.** Fake profile of this person. Brief says "namesakes handled". Pair signals on rejected/possibly-same-as.

3. **Fits existing code minimally.** `resolve` builds `reasons` per candidate. `nearDuplicate` at 0.8. Identity map renders `reasons[0]`. D is pure function. Exit trivial.

4. **Zero false-positive harm to candidate.** D lands on *other* people in rejected column. Worst case: mislabelled namesake, product tolerates, manager overrules. A, B, C fire on candidate's own accounts (40 followers, 2023 GitHub).

5. **No photo processing, no GDPR.** D uses text only (name, bio), already in SERP. Keeps brief rule: "no personality, credit, trustworthiness". Describes source, not person.

### Prosecutor

1. **Photo half has no input.** SERP schema has only `title`, `url`, `description`. No avatar URL. D's "same photo hash" is dead code.

2. **Remainder is name-only at 4% precision.** All drafts match subject's name. "Same display name" true for all. Goga: 4% at loose threshold. Pack says "require two attributes". D has one, name.

3. **Fires on innocent namesakes.** `nearDuplicate` at 0.8 Jaccard. Headlines like "Software Engineer at Google" collide for unrelated same-name people. Lineup is same-name pool; base rate of coincidental matches high.

4. **Harms a non-candidate.** Real person with no say. "Shares bio" invites reading as impersonator. Brief bars trustworthiness scores. Resolve prompt strips photos.

5. **Answers wrong job.** Robert asked for red flag "at the profile". D never reads candidate's own account. Fraud pattern is mismatch, young accounts (fabrication). D covers impersonation only, rarer; A10 unproven.

### Concessions

Doesn't cover fabrication on candidate's accounts. Goga precision is Twitter 2015. SERP rarely carries photo/bio, pairs name-only at 4%. Must require two attributes; may fire rarely.

### Cross-examination

**Advocate's strongest:** Pair signals 90% TPR (only precision); fit existing code minimally. **Prosecutor:** SERP has no photo; all drafts match name; `nearDuplicate` at 0.8 fires on formulaic headlines.

**Prosecutor's strongest:** Non-candidate labels as impersonators without consent. **Advocate:** True, D covers impersonation only. That's stated gap. A and B cover fabrication; they fire on ordinary candidates. D fires on *rejected* people only.

---

## Facts the court established about the code

- `Collector.digest` exists; runner writes it; `readCodeProfile` reads defensively; state route returns `code_profile`.
- X, GitHub print "joined" in excerpts. Instagram has no joined date. LinkedIn creation year login-gated.
- Central LinkedIn scraped in seed seam, not collector.
- Instagram collector requests "merge" or "possibly-same-as" candidates.
- ARES reusable, free, no key.
- SERP schema has only `title`, `url`, `description`; no photo field.
- `nearDuplicate` uses 0.8 token Jaccard.
- `challengeEligible` takes only FACTs with `mh-*` or `cv-consistency` ids.
- `JUDGEMENT` screen gates on `CV_QUESTION_ID` only.
- Extract prompt forbids "claims about sources" and "judgements".
- `verifyClaims` keeps only `confirmedSources` (merged). ARES unverified unless IČO matches.
- `fetchJson` JSON-only; bytes need new port.
- Goga: 90% TPR (pairs), 34% TPR (single). Humans catch 18%.
- LinkedIn harvest omits `created_at`.
- Resolve prompt avoids photos. `professionalSnippet` strips them.
- Hiring header forbids ARES.
- Eval replays recorded answers.
- `extract` uses only `confirmedSources`; rejected profiles don't reach model.
