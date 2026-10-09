# 00 — Synthesis: the recruiter flow (Robert, 2026-10-09)

**Question.** How does a recruiter go from login to a full candidate profile in one straight line, for several candidates at once?

## The flow (binding)

1. **Register or log in** (`/register`, `/login`, plans/009). Unchanged.
2. **Home = briefs.** A logged-in visit to `/` shows the briefs page (the list of this organization's briefs, grouped by position, newest first) with one primary button **New brief**. Logged-out visitors keep the landing.
3. **New brief** (`/briefs/new`, a three-step card, no modal):
   1. **Position**: pick an existing position of the organization (searchable list) or create one inline from the role catalog (title from `RoleOption`, must-haves prefilled from the template) or from a posting (text or URL, existing `/api/positions`). The chosen position's must-haves are shown read-only.
   2. **Candidates**: add one or more rows. Sourcing per row: a LinkedIn profile URL (the profile picker, plans/011), a pasted CV, or a CV file (PDF or text, `cvTextFromFile`), or tick candidates already in the position's pool (plans/010). Rows can be removed. At least one row to continue.
   3. **Research**: one button starts research for every row: new rows go through `POST /api/positions/:id/candidates` then one `POST /api/positions/:id/enrich` with all application ids (cap `ENRICH_MAX` = 20, hourly caps answer 429 with a calm message). Then route to the results table.
4. **Results table** (`/positions/:id`, section Candidates, also reachable from `/briefs`): one row per candidate with name or handle, source, status (pooled, researching with progress, done, failed), fit % for this position once done, independent-evidence count, and **Open profile**. Rows poll every few seconds while any run is in progress. No ranking, no sort by fit by default (order = added).
5. **Full profile** (`/runs/:id`): the enriched profile in the Buryan structure: Achievements, Risks, History, Working style (inference), Position fit (this position's must-haves), 5 questions, evidence accordions with Independent / Self-reported pills.

## Success criteria (the verifier runs these in a browser against the local preview)

| # | Criterion | Check |
|---|---|---|
| S1 | Logged-out `/` shows the landing with Log in / Create account; logged-in `/` shows the briefs list and a **New brief** button | screenshot both |
| S2 | **New brief** opens `/briefs/new` with step 1 Position; an existing position can be picked; a new one can be created from the role catalog without leaving the page | pick "CMO", see must-haves |
| S3 | Step 2 accepts 2+ candidates in one go: one LinkedIn URL, one pasted CV; a row can be removed; pool candidates can be ticked | 2 rows present |
| S4 | **Research** starts one run per candidate (network: 2 × candidates 201, 1 × enrich 200 with 2 started) and lands on the results table | runs visible |
| S5 | The results table shows both candidates with live status; a done row shows fit % and **Open profile** | poll until done or 10 min |
| S6 | **Open profile** shows the Buryan-structure profile with evidence accordions and strength pills | the imported Buryan run fd0edc83 is the reference |
| S7 | `/briefs` lists the runs grouped by position with status and links | screenshot |
| S8 | `pnpm check` green; e2e spec `e2e/brief-flow.spec.ts` covers S1–S5 with a mocked run (no Apify) | CI |

## Non-goals

No ranking of candidates, no scores of people, no auto-enrichment on intake, no email to candidates. Calls are handled elsewhere.
