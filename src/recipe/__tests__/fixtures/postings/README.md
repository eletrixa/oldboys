# Posting fixtures

Used by `posting-parse.test.ts`. Recorded 2026-10-08 and trimmed to what the parser reads.

| File | Source |
|---|---|
| `greenhouse-stripe-8172508.json` | `https://boards-api.greenhouse.io/v1/boards/stripe/jobs/8172508`, fields id, title, company_name, location, content (content cut to 6000 chars) |
| `ashby-ashby.json` | `https://api.ashbyhq.com/posting-api/job-board/ashby`, first 3 jobs, fields id, title, location, descriptionPlain (cut to 3000 chars) |
| `lever-palantir.json` | `https://api.lever.co/v0/postings/palantir?limit=1`, one posting, fields id, text, categories, descriptionPlain, lists (cut) |
| `jobs-cz-2001471225.html` | SYNTHESIZED. `https://www.jobs.cz/rpd/2001471225/` (title and company are real) served no `application/ld+json` on 2026-10-08 (contradicts plans/007 case studies, which recorded it as present). The JSON-LD block here follows schema.org JobPosting so the parser contract is tested; Jobs.cz needs an HTML fallback or the `jsonld` path will return empty text and ingest falls back to paste. |
