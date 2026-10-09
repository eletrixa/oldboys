# Posting fixtures

Used by `posting-parse.test.ts`. Recorded 2026-10-08 and trimmed to what the parser reads.

| File | Source |
|---|---|
| `greenhouse-stripe-8172508.json` | `https://boards-api.greenhouse.io/v1/boards/stripe/jobs/8172508`, fields id, title, company_name, location, content (content cut to 6000 chars) |
| `ashby-ashby.json` | `https://api.ashbyhq.com/posting-api/job-board/ashby`, first 3 jobs, fields id, title, location, descriptionPlain (cut to 3000 chars) |
| `lever-palantir.json` | `https://api.lever.co/v0/postings/palantir?limit=1`, one posting, fields id, text, categories, descriptionPlain, lists (cut) |
| `jobs-cz.html` | `https://www.jobs.cz/rpd/2001470594/`, recorded 2026-10-09 and trimmed (< 7 KB): `<title>`, `og:title` meta, the `data-test="jd-info-location"` link and the `data-test="jd-body-richtext"` block. Live `/rpd/<id>` pages carry no JSON-LD. |
| `jobs-cz-jsonld-synthetic.html` | SYNTHESIZED. Follows schema.org JobPosting so the JSON-LD fallback of the `jobs-cz` method (and the `jsonld` method) is tested. Real Jobs.cz pages do not have this block. |
| `startupjobs.html` | `https://www.startupjobs.cz/nabidka/49819/embedded-c-developer`, recorded 2026-10-09 and trimmed to the `og:title` meta and the `application/ld+json` block (a `@graph` with `WebSite` and `JobPosting`). The page body is rendered by JavaScript. |
| `jobscz-widget-inline.html` | `https://asseco.jobs.cz/?r=detail&id=2001292088` (target of `https://www.jobs.cz/rpd/2001292088/`), trimmed to the inline `window.__LMC_CAREER_WIDGET__.push({...})` call. API key and widget id replaced by fake values. |
| `jobscz-widget-page.html` | `https://jablotron.jobs.cz/detail-pozice?r=detail&id=2001283886` (target of `https://www.jobs.cz/rpd/2001283886/`), trimmed to the `script.min.js` tag and the `data-widget="main"` container. No posting text in the HTML. |
| `jobscz-widget-redirect.html` | `https://jablotron.jobs.cz/assets/js/script.min.js?av=…` as served: a meta-refresh page pointing at `site-assets.jobs.cz`. |
| `jobscz-widget-script.js.txt` | 1.3 KB around the `"widgets":{...}` config inside the site script on `site-assets.jobs.cz`. API keys and widget ids replaced by fake values. `.txt` so ESLint skips it. |
| `jobscz-widget-reply.json` | Reply of `POST https://api.capybara.lmc.cz/api/graphql/widget` for job ad 2001283886 (title, headerText, teaser, content.htmlContent, sections, locations, employer). |
