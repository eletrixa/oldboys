# 00 — Synthesis: deep research (Robert, 2026-10-09)

**Question.** Why does a brief on a public figure stop at a dozen sources, and what makes it five times deeper without breaking the identity and FACT rules?

## Diagnosis (from the 2026-10-09 local runs)

1. Google SERP hits are stored as the search snippet only (title + description, under 300 chars). No step read the page.
2. A SERP hit stays `unverified` unless the lineup made it a web candidate or the deterministic corroboration pass (name + confirmed employer token) upgraded it; extract reads `confirmedSources` only. A run with 70 mentions fed 8 to 12 sources to the model.
3. Extract is one model call capped at 60k prompt characters; whatever did not fit was silently dropped.
4. No source type covered regulators, courts, markets or encyclopaedias at all.

## Decision (binding)

| Part | What | Where |
|---|---|---|
| Free REST sources | `rest/sec-edgar` (EDGAR full-text search: filings naming the person, newest 25 + an overview sentence with totals by form), `rest/wikipedia` (en + cs search, summaries of articles naming them in full), `rest/podcasts` (Apple Podcasts episode index) | `src/recipe/sources/{sec-edgar,wikipedia,podcasts}.ts` |
| SERP packs | `regulatory_serp` (sec.gov, 13D, proxy, shares, investor, acquisition), `legal_serp` (lawsuit, court, insolvency, enforcement, sanctions), `business_press_serp` (Czech and international business press by site:), `boards_serp` (board, founder, partner, team pages) | `src/recipe/goals/hiring.ts` |
| Read pages | `read_pages` (`rest/read-pages`): after every collector and the identity pass, fetch up to 12 confirmed web pages (sec.gov first), turn HTML to text, keep up to 4 windows of ±500 chars around the name (verbatim), replace the snippet excerpt in place (`ParsedSource.replaces`, same source id, up to 6000 chars) | `src/domain/html-text.ts`, `src/recipe/sources/read-pages.ts`, `src/recipe/runner.ts`, `src/workflow/research-run.ts` |
| Extract at scale | batches of ≤60k chars, ≤3 in parallel, max 6 batches; claims unioned; a failed batch is a note | `src/recipe/seams/extract.ts` |
| Caps | brief evidence list 40 → 120; profile seam source block by characters, not count | `synthesize.ts`, `profile.ts` |
| Questions | `regulatory-filings` ("Filings and markets"), `legal-record` ("Legal record") | `hiring.ts`, `sections.ts` |
| Budget | `RUN_BUDGET_USD` 2.00, `RUN_BUDGET_CALLS` 24; time promise "5 to 10 minutes" | `wrangler.jsonc`, copy |

Identity rules do not change: every new source arrives `unverified` and is upgraded only by the existing corroboration (full name + confirmed employer token) or a lineup merge. The page reader reads confirmed pages only. FACT still needs a verbatim quote inside the excerpt; the mention windows keep the page text verbatim so quotes verify.

Due-diligence is unchanged (adding the shared steps there would push the shared-step ratio over the goal-delta gate).

## Verification

Local preview, position "Chief Executive Officer" or "Engineering Manager", candidate `https://www.linkedin.com/in/dusansenkypl/`: the brief must cite SEC filings (Schedule 13D on Groupon, Pale Fire Capital), Czech Wikipedia, at least one podcast episode and business-press articles quoted from the page text, with the two new sections filled.
