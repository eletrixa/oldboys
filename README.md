# oldboys — Social Media Deep Research (Hackathon Case 01, Apify)

Hackathon build. Live at https://oldboys.asajj.cz (Cloudflare Workers).

- `docs/brief.md` — the assignment
- `docs/01-brainstorm.md` — ideas, top 5
- `docs/02-discovery.md` — users per goal, source landscape, assumptions, experiments
- `docs/03-pre-mortem.md` — what kills it at sunrise, mitigations
- `plans/001-deep-research-arch/` — architecture dossier; start at `00-SYNTHESIS.md`
- `overview/index.html` — one-page overview; `cd overview && python3 -m http.server 4242`

Status: scaffolded 2026-10-08, deploy target Cloudflare Workers (plans/002)

## Quickstart
```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

## Deploy
```sh
wrangler login
wrangler r2 bucket create oldboys-sources
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put APIFY_TOKEN
wrangler secret put RUN_TOKEN           # bearer token required by POST /api/runs
pnpm db:migrate:remote
pnpm deploy
```

## Links
- `rules/` — coding rules for this repo (start at `rules/README.md`)
- `plans/002-cloudflare-platform/` — binding platform decision
