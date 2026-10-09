# Trust box — Synthesis

> **Decision proposed: a "Confidence in this brief" card, not a trust score of the person.** The brief lists trustworthiness scores of a person under *Out of bounds*; honesty is 10% of the jury score. The card scores the **evidence** and states the **identity match** and the **checks done**; nothing in it is a number about the candidate. Dossier: 01 brainstorm, 02 discovery, 03 pre-mortem.

## Options (what the box can be)
| | Option | Number? | Brief | Verdict |
|---|---|---|---|---|
| A | **Evidence confidence** — % of claims that are verified FACTs, source count, independent hosts, challenges held/moved | Yes, about the brief | Allowed; supports honesty | Recommend |
| B | **Identity strip** — Confirmed identity / Corroborated / Open (n accounts await your answer), from `resolve.ts` corroboration | No (label) | Allowed; namesake handling is required | Recommend |
| C | **Checks ledger** — registries searched and records attributed, CV match/differ/not-found, accounts read, steps not searched; each with Ask/Check | Counts only | Allowed | Recommend |
| D | **Consistency %** — share of CV statements confirmed by public sources | Yes, about the person's statements | Grey: a "how truthful is the CV" number is a trust score by another name | Keep as counts inside C, never a % |
| E | **Person trust score** — 0–100 from risks, signals, registries, CV differences | Yes, about the person | Out of bounds; Art. 22 exposure | Reject |

## Shape
One card after the 30-second summary (before or after the 013 scorecard, decide at layout): three strips — Evidence (figure + definition), Identity (label + lineup link), Checks (counts + Ask/Check lines) — footer "A measure of the evidence we found and the checks we ran, not of the person."

## Code (if approved)
- `src/app/runs/[id]/trust-box.ts` (+ test): `trustBox(state: RunState)`, pure; evidence = FACT with verify pass ÷ claims; identity label from candidate decisions and `identity_reason`; checks from `registry_checks`, `cvCounts`, `profile_signals`, `not_searched`.
- `trust-box-card.tsx` (+ test); wording guard test; `parts.tsx` renders it; CHANGELOG + JURY.md.
- Older runs without verify rows: figure null, strip says so.

## Open before build
1. Robert accepts "no person score" (03 T1/T7).
2. Card name and page order relative to plan 013.
3. E1/E2 from 02 if time allows; else ship A+B+C with the footer and review wording on the local QA run.
