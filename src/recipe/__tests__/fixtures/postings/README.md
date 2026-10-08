# Posting fixtures

Used by `posting-parse.test.ts`. Recorded 2026-10-08 and trimmed to what the parser reads.

| File | Source |
|---|---|
| `greenhouse-stripe-8172508.json` | `https://boards-api.greenhouse.io/v1/boards/stripe/jobs/8172508`, fields id, title, company_name, location, content (content cut to 6000 chars) |
| `ashby-ashby.json` | `https://api.ashbyhq.com/posting-api/job-board/ashby`, first 3 jobs, fields id, title, location, descriptionPlain (cut to 3000 chars) |
| `lever-palantir.json` | `https://api.lever.co/v0/postings/palantir?limit=1`, one posting, fields id, text, categories, descriptionPlain, lists (cut) |
| `jobs-cz.html` | `https://www.jobs.cz/rpd/2001470594/`, recorded 2026-10-09 and trimmed (< 7 KB): `<title>`, `og:title` meta, the `data-test="jd-info-location"` link and the `data-test="jd-body-richtext"` block. Live `/rpd/<id>` pages carry no JSON-LD. |
| `jobs-cz-jsonld-synthetic.html` | SYNTHESIZED. Follows schema.org JobPosting so the JSON-LD fallback of the `jobs-cz` method (and the `jsonld` method) is tested. Real Jobs.cz pages do not have this block. |
