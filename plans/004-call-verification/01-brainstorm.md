# 01 — Brainstorm (existing product, three perspectives)

Product: oldboys deep research. Problem: a run ends with claims and gaps that public data cannot close. A short consented phone call may close them.

## Product Manager

1. **Gap-closing call.** One question per Gap. The answer becomes a sourced claim with a transcript quote.
2. **Contradiction call.** Ask the callee to adjudicate two conflicting claims. The result is a rank change, never a delete.
3. **Consent-first script.** AI disclosure, purpose, recording consent, hang up on refusal.
4. **Call cost preview.** Estimated minutes and USD shown before approval.
5. **Per-goal call scripts.** Hiring asks about role and dates. Due diligence asks about statutory body and address.

## Product Designer

6. **Brief as a card.** Script and expected answers shown; approve button enabled only after consent checkbox and number entry.
7. **Transcript as a source card.** Labeled "Phone call (AI interviewer)" or "MOCK".
8. **Live status on the existing SSE stream.** drafted, dialing, in call, done.
9. **Honest refusal.** Shown as "callee declined".
10. **Skip button.** Records "not called" as a stated gap.

## Engineer

11. **Separate Workflow per call.** The research run stays bounded.
12. **Provider port with a mock.** Tests and demo never need Twilio.
13. **HMAC webhook with an idempotency table.**
14. **ElevenLabs `data_collection` fields generated from the brief.** Structured extraction, LLM extract as fallback.
15. **Raw webhook payload to R2.** Excerpt only in D1.
16. **Transcript quote verification reuses the quote-in-excerpt rule** used for web sources.

## Top 5 carried forward

| # | Idea | Why |
|---|---|---|
| 1 | Gap-closing call | Core value: turns a stated gap into evidence |
| 3 | Consent-first script | Legal and honesty baseline; drives the brief invariants |
| 11 | Separate Workflow per call | Keeps the research run bounded and untouched (Option A) |
| 12 | Provider port with a mock | Makes the whole path testable and demoable without a phone |
| 13 | HMAC webhook with idempotency table | Required by repo security rules; the riskiest integration point |

**Quick wins:** 12, 15. **Strategic bet:** 14 (structured extraction from ElevenLabs, with LLM extract as fallback; field names UNCONFIRMED, see 06). Ideas 2, 4, 6 to 10 are UI-side or later and stay out of the backend scope.
