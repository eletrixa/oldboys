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
    Write-Host "typecheck + lint + test" -ForegroundColor White
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
    Write-Host "    pnpm test:watch                        " -NoNewline -ForegroundColor Green
    Write-Host "Vitest watch mode" -ForegroundColor White
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
