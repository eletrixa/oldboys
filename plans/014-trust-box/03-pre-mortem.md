# Pre-mortem: Trust box

It is judging day and the Trust box cost us points. What happened?

## Tigers
| # | Risk | Likelihood | Impact | Class | Mitigation |
|---|---|---|---|---|---|
| T1 | We shipped a 0–100 "trust score" of the person; a judge quotes `docs/brief.md` *Out of bounds* back at us, honesty 10% gone and originality questioned | H if built as asked | Launch-blocking | Do not build it. The figure measures the brief's evidence; the title and footer say so; the number is never derived from risks, registries, signals or CV differences |
| T2 | Even the evidence figure is read as a person score once it sits in a box called "Trust" | M | Launch-blocking | Name the card "Confidence in this brief" (or "Evidence"); the figure carries its definition inline; no colour scale |
| T3 | Identity label "Unresolved" reads as "fake" | M | Launch-blocking | Label set is "Confirmed identity / Corroborated / Open — n accounts await your answer", with the lineup link; no word that judges |
| T4 | Checks ledger lines ("1 CV statement differs", "registry record found") read as findings against the person | M | Fast-follow | Keep source wording, attach Ask/Check, wording guard test (JUDGEMENT, ACCUSATION) |
| T5 | Two figures on the page (fit 43, evidence 78) get averaged or confused by the reader | M | Fast-follow | Different units in the label ("43 of 100 must-have points", "78% of claims verified"); never side by side in the same row |
| T6 | Thin demo subjects show evidence 35% and the box makes the tool look weak | M | Track | That is the honest state; add "n sources, m steps not searched" so the low figure explains itself; it is a feature for the honesty criterion |
| T7 | GDPR Art. 22 / profiling: a person score with legal effect on hiring is automated decision-making | H if T1 built | Launch-blocking | Same as T1; the evidence figure is about the document and supports a human decision |
| T8 | Older runs lack `challenge_summary` or verify rows → NaN or crash | M | Launch-blocking | Null figure, strip prints "verification record not kept for this run" |

## Paper tigers
- "Without a trust score the box is empty." The ledger has 14 registries, CV counts, accounts read and the identity state; that is the content recruiters quoted as useful in 012.
- "Judges want a bold number for originality." Originality is scored on goal logic and honesty handling; a report-level confidence figure with a devil's advocate record is rarer than a person score.

## Elephants
- Robert asked for a *trust score of the person*. The brief forbids it. Someone has to say so before code exists; this dossier does.
- Plan 013 (scorecard) is uncommitted and overlaps: two cards, two numbers. Decide the page order and whether the trust box absorbs 013's "Minuses" column (it should not; 013 is about the role, this is about the evidence).
- The identity label depends on `resolve.ts` thresholds that were tuned on the eval set, not on live recruiters (E3).

Kill criteria: if E1/E2 show the evidence figure is read as a person score, ship the ledger without any figure.
