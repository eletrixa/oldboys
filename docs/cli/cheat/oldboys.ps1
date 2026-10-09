<# Cheatsheet: cheatoldboys — Next.js 16 on Cloudflare Workers (OpenNext, Workflows, D1, R2). #>
function global:cheatoldboys {
    Write-Host ""
    Write-Host "  ╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║           OLDBOYS CHEATSHEET (Next.js + Cloudflare)           ║" -ForegroundColor Cyan
    Write-Host "  ╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  DEVELOPMENT                                                   │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    pnpm dev                               " -NoNewline -ForegroundColor Green
    Write-Host "Start Next.js dev server" -ForegroundColor White
    Write-Host "    pnpm preview                           " -NoNewline -ForegroundColor Green
    Write-Host "Build and preview on the Workers runtime" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  BUILD                                                         │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    pnpm build                             " -NoNewline -ForegroundColor Green
    Write-Host "Next.js production build" -ForegroundColor White
    Write-Host "    pnpm preview                           " -NoNewline -ForegroundColor Green
    Write-Host "OpenNext Cloudflare bundle" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  CODE QUALITY                                                  │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    pnpm typecheck                         " -NoNewline -ForegroundColor Green
    Write-Host "TypeScript type check" -ForegroundColor White
    Write-Host "    pnpm lint                              " -NoNewline -ForegroundColor Green
    Write-Host "Lint" -ForegroundColor White
    Write-Host "    pnpm check                             " -NoNewline -ForegroundColor Green
    Write-Host "typecheck + lint + test (app + extension)" -ForegroundColor White
    Write-Host "    pnpm ext:build                         " -NoNewline -ForegroundColor Green
    Write-Host "Build the browser extension: extension/.output/chrome-mv3 (Chrome+Edge) and firefox-mv3" -ForegroundColor White
    Write-Host "    pnpm --filter oldboys-extension check  " -NoNewline -ForegroundColor Green
    Write-Host "Extension only: wxt prepare + tsc + eslint + vitest" -ForegroundColor White
    Write-Host "    pnpm hooks:install                     " -NoNewline -ForegroundColor Green
    Write-Host "Enable pre-commit hook (runs pnpm check on code changes)" -ForegroundColor White
    Write-Host "    scripts/agent-check.sh                 " -NoNewline -ForegroundColor Green
    Write-Host "Same gate the Claude Stop hook runs" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  TESTING                                                       │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    pnpm test                              " -NoNewline -ForegroundColor Green
    Write-Host "Run Vitest once" -ForegroundColor White
    Write-Host "    pnpm eval                              " -NoNewline -ForegroundColor Green
    Write-Host "Run the synthetic eval set; writes eval/results.json + eval/RESULTS.md" -ForegroundColor White
    Write-Host "    pnpm test:watch                        " -NoNewline -ForegroundColor Green
    Write-Host "Vitest watch mode" -ForegroundColor White
    Write-Host "    pnpm e2e                               " -NoNewline -ForegroundColor Green
    Write-Host "Root Playwright smoke against pnpm dev on port 3141" -ForegroundColor White
    Write-Host "    LIVE=1 SUBJECT=.. ANCHOR=.. REPORT=out.txt pnpm exec vitest run live-sources" -ForegroundColor Green
    Write-Host "                                           Live Apify smoke of every hiring collector (spends ~\$0.01)" -ForegroundColor White
    Write-Host "    node scripts/ui-flow.mjs name city role prefix" -NoNewline -ForegroundColor Green
    Write-Host "  Screen 1 -> 2 browser flow + screenshots against pnpm preview" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  DEPLOYMENT                                                    │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    pnpm deploy                            " -NoNewline -ForegroundColor Green
    Write-Host "Build and deploy to Cloudflare Workers" -ForegroundColor White
    Write-Host "    wrangler secret put ANTHROPIC_API_KEY  " -NoNewline -ForegroundColor Green
    Write-Host "Set Anthropic key in prod" -ForegroundColor White
    Write-Host "    wrangler secret put APIFY_TOKEN        " -NoNewline -ForegroundColor Green
    Write-Host "Set Apify token in prod" -ForegroundColor White
    Write-Host "    wrangler secret put RUN_TOKEN          " -NoNewline -ForegroundColor Green
    Write-Host "Bearer token required by POST /api/runs" -ForegroundColor White
    Write-Host "    cron 0 3 * * *                         " -NoNewline -ForegroundColor Green
    Write-Host "Nightly purge of expired raw sources (src/workflow/purge.ts)" -ForegroundColor White
    Write-Host "    cron */15 * * * *                      " -NoNewline -ForegroundColor Green
    Write-Host "Start runs for capped intake applications (src/workflow/intake.ts)" -ForegroundColor White
    Write-Host "    wrangler secret put ELEVENLABS_API_KEY " -NoNewline -ForegroundColor Green
    Write-Host "ElevenLabs API key (verification calls)" -ForegroundColor White
    Write-Host "    wrangler secret put ELEVENLABS_WEBHOOK_SECRET " -NoNewline -ForegroundColor Green
    Write-Host "HMAC secret for POST /api/webhooks/elevenlabs" -ForegroundColor White
    Write-Host "    wrangler secret put TREG_TOKEN         " -NoNewline -ForegroundColor Green
    Write-Host "Optional treg.to token: second-source profile reads (docs/ops/treg.md)" -ForegroundColor White
    Write-Host "    pnpm db:migrate:remote                 " -NoNewline -ForegroundColor Green
    Write-Host "Apply migrations to prod D1 (before pnpm deploy)" -ForegroundColor White
    Write-Host "    pnpm cf-typegen                        " -NoNewline -ForegroundColor Green
    Write-Host "Generate Env types from wrangler.jsonc" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  DATABASE                                                      │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    pnpm db:migrate:local                  " -NoNewline -ForegroundColor Green
    Write-Host "Apply migrations to local D1" -ForegroundColor White
    Write-Host "    pnpm db:migrate:remote                 " -NoNewline -ForegroundColor Green
    Write-Host "Apply migrations to remote D1" -ForegroundColor White
    Write-Host "    pnpm roles:sql                         " -NoNewline -ForegroundColor Green
    Write-Host "Print role_templates seed INSERTs from src/domain/role-catalog (paste into a migration)" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  ENVIRONMENT VARIABLES                                         │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    POSITION_INGEST_USD=0.05               " -NoNewline -ForegroundColor Green
    Write-Host "Budget cap for position must-haves LLM call (wrangler.jsonc var)" -ForegroundColor White
    Write-Host "    CALL_PROVIDER=mock|elevenlabs          " -NoNewline -ForegroundColor Green
    Write-Host "wrangler.jsonc var for verification calls" -ForegroundColor White
    Write-Host "    POST /api/runs/:id/calls               " -NoNewline -ForegroundColor Green
    Write-Host "Draft a verification call" -ForegroundColor White
    Write-Host "    POST /api/calls/:id/approve            " -NoNewline -ForegroundColor Green
    Write-Host "Approve and dial" -ForegroundColor White
    Write-Host "    POST /api/calls/:id/skip               " -NoNewline -ForegroundColor Green
    Write-Host "Skip a drafted call" -ForegroundColor White
    Write-Host "    GET /api/calls/:id                     " -NoNewline -ForegroundColor Green
    Write-Host "Call status and result" -ForegroundColor White
    Write-Host "    node scripts/call-smoke.mjs            " -NoNewline -ForegroundColor Green
    Write-Host "live smoke; needs SMOKE_TO_NUMBER + RUN_TOKEN env" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  REGISTRATION                                                  │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    GET /register                          " -NoNewline -ForegroundColor Green
    Write-Host "Recruiter signup form (email, password, name, IČO)" -ForegroundColor White
    Write-Host "    POST /api/auth/register                " -NoNewline -ForegroundColor Green
    Write-Host "Create account and organization (201 + Set-Cookie or 409/429)" -ForegroundColor White
    Write-Host "    GET /login                             " -NoNewline -ForegroundColor Green
    Write-Host "Recruiter login form" -ForegroundColor White
    Write-Host "    POST /api/auth/login                   " -NoNewline -ForegroundColor Green
    Write-Host "Authenticate account (200 + Set-Cookie or 401/429)" -ForegroundColor White
    Write-Host "    POST /api/auth/logout                  " -NoNewline -ForegroundColor Green
    Write-Host "Logout (204, clears session cookie)" -ForegroundColor White
    Write-Host "    GET /api/ares/:ico                     " -NoNewline -ForegroundColor Green
    Write-Host "Look up company by IČO (200/404/400/502)" -ForegroundColor White
    Write-Host "    GET /onboarding                        " -NoNewline -ForegroundColor Green
    Write-Host "Post-signup onboarding (shows company, start form)" -ForegroundColor White
    Write-Host "    GET /briefs                            " -NoNewline -ForegroundColor Green
    Write-Host "List organization's research runs (scoped by session)" -ForegroundColor White
    Write-Host "    pnpm db:migrate:local                  " -NoNewline -ForegroundColor Green
    Write-Host "Apply 0010_accounts migration (organizations, accounts, sessions, auth_attempts)" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  INTAKE (plans/008, docs/ops/intake.md)                        │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    wrangler secret put INTAKE_TOKEN       " -NoNewline -ForegroundColor Green
    Write-Host "Bearer for POST /api/intake/form (Apps Script)" -ForegroundColor White
    Write-Host "    wrangler secret put STARTUPJOBS_WEBHOOK_TOKEN " -NoNewline -ForegroundColor Green
    Write-Host "Path token in the StartupJobs webhook URL" -ForegroundColor White
    Write-Host "    wrangler secret put STARTUPJOBS_TOKEN  " -NoNewline -ForegroundColor Green
    Write-Host "Optional: StartupJobs API bearer for CV downloads" -ForegroundColor White
    Write-Host "    INTAKE_PER_HOUR_CAP / _FORWARD_TO / _FROM_ALLOW " -NoNewline -ForegroundColor Green
    Write-Host "wrangler.jsonc vars: hourly run cap, human copy, sender allow-list" -ForegroundColor White
    Write-Host "    POST /api/intake/form                  " -NoNewline -ForegroundColor Green
    Write-Host "Google Forms via Apps Script (Bearer INTAKE_TOKEN)" -ForegroundColor White
    Write-Host "    POST /api/apply                        " -NoNewline -ForegroundColor Green
    Write-Host "Hosted page /apply/<tag> (same-origin, honeypot, fill time)" -ForegroundColor White
    Write-Host "    APPLY_RATE_LIMIT                       " -NoNewline -ForegroundColor Green
    Write-Host "wrangler.jsonc ratelimits binding: 5 apply sends per IP a minute" -ForegroundColor White
    Write-Host "    POST /api/intake/startupjobs/<token>   " -NoNewline -ForegroundColor Green
    Write-Host "StartupJobs webhook (test button sends test:true)" -ForegroundColor White
    Write-Host "    GET /api/intake/applications           " -NoNewline -ForegroundColor Green
    Write-Host "Queue, last 200 (Bearer RUN_TOKEN); no UI page, bound tags show on the position page" -ForegroundColor White
    Write-Host "    GET|POST /api/intake/tags              " -NoNewline -ForegroundColor Green
    Write-Host "List / create tag -> role (Bearer RUN_TOKEN)" -ForegroundColor White
    Write-Host "    jobs+<tag>@asajj.cz                    " -NoNewline -ForegroundColor Green
    Write-Host "Email door: Gmail forward, Seznam copy, Jobs.cz, LinkedIn" -ForegroundColor White
    Write-Host "    pnpm exec opennextjs-cloudflare build  " -NoNewline -ForegroundColor Green
    Write-Host "Needed before the local email test below" -ForegroundColor White
    Write-Host "    pnpm exec wrangler dev                 " -NoNewline -ForegroundColor Green
    Write-Host "Serves the Worker with email() on :8787" -ForegroundColor White
    Write-Host "    curl -X POST 'localhost:8787/cdn-cgi/handler/email?from=a@b.cz&to=jobs+senior-be@asajj.cz' --data-binary @x.eml " -NoNewline -ForegroundColor Green
    Write-Host "Local email test (see docs/ops/intake.md)" -ForegroundColor White
    Write-Host "    pnpm db:migrate:remote                 " -NoNewline -ForegroundColor Green
    Write-Host "0009_intake.sql to prod D1 before deploy (Robert runs it)" -ForegroundColor White
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────────────┐" -ForegroundColor DarkGray
    Write-Host "  │  NAVIGATION                                                    │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────────────┘" -ForegroundColor DarkGray
    Write-Host "    GoOldboys                              " -NoNewline -ForegroundColor Green
    Write-Host "Jump to F:\code\oldboys" -ForegroundColor White
    Write-Host ""
    Write-Host "  ─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "    Repo: " -NoNewline -ForegroundColor DarkGray
    Write-Host "F:\code\oldboys" -ForegroundColor White
    Write-Host ""
}
Set-Alias -Name oldboyscheat -Value cheatoldboys -Scope Global -ErrorAction SilentlyContinue
