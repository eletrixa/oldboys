# Brainstorm: Trust box (profile page)

**Mode**: Ideas for an existing product (oldboys hiring report)
**Context**: Robert asked for a "TRUST box with a trust score" on the profile. The brief lists "personality, credit or 'trustworthiness' scores of a person" under *Out of bounds* (`docs/brief.md`), and honesty is 10% of the jury score. So the question is not "how to compute a trust score" but "what can a Trust box honestly contain", and the answer is: numbers about the **brief** and the **identity match**, lists about the **checks**, never a number about the person. Plan 013 (role-fit scorecard, uncommitted) already owns the role-fit number; the trust box must not become a second person score next to it.

## What already exists (inputs, zero new I/O)
| Input | Where | Use |
|---|---|---|
| Claims with kind FACT/INFERENCE, verify pass, supports | `state.claims`, verify ledger rows | share of FACT among claims, verify pass rate |
| Devil's advocate record | `state.challenges`, `challenge_summary {checked, held, moved}` | how many must-have FACTs survived a challenge |
| Candidates with decision merge / possibly-same-as, `identity_reason` on sources | `state.candidates`, `state.sources` | identity strength label |
| CV statements matched / differs / not found | `cvCounts` (`cv-check.ts`) | consistency counts |
| Registry checks (14 registries, hits attributed or namesake) | `state.registry_checks` | "checked, no record" lines |
| Profile signals for merged accounts | `state.profile_signals` | account facts with an Ask |
| Not searched / searched empty | `brief.not_searched`, `searched_empty` | coverage |
| Source count and independent hosts | `state.sources` | breadth of evidence |

## PM perspective
1. **"How far to trust this brief"** — the box scores the report: % of claims that are verified FACTs, sources count, independent hosts, challenge survivals. One number, about the evidence. | Impact H | Effort M
2. **Identity strip** — label "Confirmed identity / Corroborated / Unresolved" from the merge rules (given profile, anchor, employer, cross-link); no number. | Impact H | Effort L
3. **Checks ledger** — "14 registries searched, 0 records attributed; CV: 9 statements match, 1 differs, 3 not found; 3 accounts read" with Ask/Check lines; counts, no score. | Impact H | Effort L
4. **Person trust score** — the literal ask: one 0–100 number of the person's trustworthiness from risks, signals, registries and CV differences. Out of bounds in the brief; kills honesty points; Art. 22 profiling exposure. | Impact −H | Effort M
5. **Trust box in the kit export and the position table** — the brief-confidence number next to fit % per pooled candidate. | Impact M | Effort L

## Designer perspective
1. **Three quiet strips, one figure** — Evidence (figure), Identity (label), Checks (counts); serif figure, no colour scale, Radar tokens like the other cards. | Impact H | Effort L
2. **The figure names its object** — "Evidence confidence 78 — share of this brief's claims that are verified facts", never a bare "Trust 78". | Impact H | Effort L
3. **"What this is not" footer** — one sentence: a measure of the evidence we found, not of the person. | Impact H | Effort L
4. **Unresolved identity as a question, not a flag** — "We could not link 2 of 5 accounts to this person; the lineup asks you" with the lineup button. | Impact M | Effort L
5. **Print / kit** — the same three strips open the interview kit. | Impact L | Effort L

## Engineer perspective
1. **Pure composer `trustBox(state)`** — sibling of `summary.ts` and `scorecard.ts`; no model, no I/O, no stored field. | Impact H | Effort L
2. **Evidence figure from ledger facts only** — FACT with passed verify ÷ all claims; challenge `moved` counted as downgrades already applied (they are, since challenges only downgrade). | Impact H | Effort L
3. **Identity label from `resolve.ts` corroboration** — reuse the strong-link rule, do not re-derive. | Impact H | Effort L
4. **Wording guard** — every sentence passes `JUDGEMENT` and `ACCUSATION` (`challenge.ts`) in tests, like signals and the scorecard. | Impact M | Effort L
5. **Degraded modes** — no claims (AI off) → figure null, strips still print counts; no candidates → identity "given profile" only. | Impact M | Effort L

## Top 5
| Rank | Idea | Why | Quick win? |
|---|---|---|---|
| 1 | Evidence confidence figure (report-level) | The only honest number; aligns with judging "honesty" and "value" | Yes |
| 2 | Identity strip label | Namesake handling is a scored brief requirement; label, not score | Yes |
| 3 | Checks ledger with Ask/Check | Gives the recruiter "what was checked" without judging | Yes |
| 4 | Pure composer + wording guard | Same pattern as 012/013, zero cost | Yes |
| 5 | Kit / position table reuse | Later | No |

Idea PM-4 (person trust score) is rejected, see 03-pre-mortem T1.
