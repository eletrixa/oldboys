# 01 — Deep dive: codebase and official docs

Research date 2026-10-08. Raw reports with every URL: `evidence/research-mv3-docs.md`, `evidence/research-frameworks.md`. Claims without a traceable source carry **ASSUMPTION**.

## Codebase (current state)
- Runner: `src/workflow/research-run.ts`, Cloudflare Workflow; `step.waitForEvent('lineup-answer')` at the resolve step; statuses `queued | running | paused | done | failed` in `investigations.status` (`migrations/0001_init.sql`, `src/domain/claim.ts` `InvestigationStatus`). `paused` is the namesake wait.
- Routes: `POST /api/runs` (bearer `RUN_TOKEN`, Zod body `{subject, anchor, goal}`), `GET /api/runs/:id/events` (SSE, polls D1 every 1 s, replays ledger, closes on terminal status or 1 h), `POST /api/runs/:id/answer` (`{candidateId}` → `instance.sendEvent`). No JSON status route, no `sourceUrl`, no per-token rate cap.
- Tables that a status projection needs: `investigations`, `claims` (kind FACT/INFERENCE), `gaps`, `candidates` (decision merge / possibly-same-as / rejected).
- Goals: `hiring`, `due-diligence` (`GoalId`). Report page `/runs/:id` does not exist yet; `src/app/page.tsx` is a static form.
- Gate: `pnpm check` = typecheck + eslint strictTypeChecked + vitest; Stop hook and pre-commit run `scripts/agent-check.sh`.
- Pain relevant here: nothing in the API is shaped for a client that cannot hold a connection open; the SSE route is the only read path.

## Chrome MV3 (developer.chrome.com, lifecycle page updated 2023-05-02, alarms page 2026-10-04)
- Service worker stops after 30 s idle, after a single event over 5 min, or when a `fetch()` response takes over 30 s. Extension API calls, ports, WebSocket traffic (116+), offscreen messages reset the timer. SSE / `EventSource` is not on the keep-alive list; **ASSUMPTION: it does not keep the worker alive.**
- `chrome.alarms`: minimum period 0.5 min since Chrome 120 (1 min before); unpacked extensions have no minimum. Alarms must be re-created on worker start (persistAcrossSessions only from Chrome 150).
- `chrome.notifications`: `create`, `onClicked`, `requireInteraction`, up to two buttons; macOS drops images. OS Focus modes not covered by docs.
- Badge: `action.setBadgeText`, about four characters.
- Web Push: worker receives Push messages and is woken; `userVisibleOnly:false` since 121; VAPID key; needs `notifications` permission. Chrome and Edge only.
- `sidePanel`: Chrome 114+, `open()` needs a user gesture plus tabId/windowId.
- Cross-origin `fetch` from the worker or extension pages is allowed by `host_permissions`; content scripts stay bound by CORS. Origin header value from the worker: unconfirmed; do not rely on it server-side.
- `storage.local` 10 MB; `storage.session` in memory, cleared on restart.
- Store policy: single purpose, Limited Use, no remote code or `eval`; scraping must be disclosed, not banned.

## Firefox MV3 (MDN, pages modified 2026-04 to 2026-09)
- No `background.service_worker` (bug 1573659). Non-persistent event page via `background.scripts`; unloads "after a few seconds" of inactivity (exact figure unconfirmed); open extension views keep it alive.
- One manifest with both `service_worker` and `scripts` works in Chrome 121+ and Firefox 121+.
- `browser_specific_settings.gecko.id` required for signing. New AMO submissions since 2025-11-03 must declare `gecko.data_collection_permissions` (Firefox 140+).
- `host_permissions` are optional and not granted at install; Firefox 127+ shows them in the install prompt.
- Notifications: only `type: basic`, `title`, `message`, `iconUrl`; no buttons, no `requireInteraction`; rapid repeated `create` may show nothing. `onClicked` exists.
- Alarms do not persist across sessions; minimum period unconfirmed (treat as 1 min).
- Sidebar: `sidebar_action`, not `sidePanel`.

## Edge (learn.microsoft.com, updated 2026-08-12)
- Chrome APIs and manifest keys are code-compatible. Remove `update_url`, keep "Chrome" out of name and description, publish separately on Edge Add-ons. The Chrome zip is accepted unchanged (**secondary source only**).

## Frameworks (GitHub and npm data fetched 2026-10-08)
| Tool | Stars | Open issues | Last release | npm downloads / month |
|---|---|---|---|---|
| WXT | 10.6k | 205 | 0.21.4 on 2026-08-11 | 2.6M |
| Plasmo | 13.2k | 371 | 0.90.5 on 2025-05-17 | 2.5M |
| CRXJS | 4.2k | 20 | 2.7.0 on 2026-06-19 | 1.6M |
| web-ext | 3.1k | 220 | 10.7.0 on 2026-09-21 | 0.9M |
| webextension-polyfill | archived | | | 7.8M |

- WXT: `wxt build -b chrome|firefox|edge`; manifest generated from `wxt.config.ts`; emits `service_worker` or `scripts` per target; `createShadowRootUi` for content-script UI; `WxtVitest` plugin with `@webext-core/fake-browser`; `wxt zip -b firefox` also emits the sources zip; `wxt submit`. Risks: 0.x with breaking minors (pin), single main maintainer, auto-imports are magic (can be disabled). **Open item**: docs say Firefox defaults to MV2; verify `wxt build -b firefox --mv3`.
- Plasmo: no tagged release for 17 months, Parcel, Tailwind v4 bugs open since 2025-02. Skip.
- CRXJS: revived in 2025, strong HMR, but no shadow-root helper, no packaging, Firefox support only via secondary sources.
- Plain Vite plus hand-written manifests: zero magic, but dual manifests, IIFE content scripts and zips are ours to maintain.
- Playwright loads extensions in Chromium only (`--load-extension`, bundled `chromium` channel for headless). Firefox end-to-end needs `web-ext run`, manual.
- Two artefacts are needed for the stores: one Chromium zip (Chrome Web Store and Edge), one Firefox zip plus sources zip (AMO).

## Postgres-first check
Not applicable in the usual sense: the platform decision (002) fixed D1 as the ledger. The only new persistent data is `sourceUrl` on `investigations` and, in Option C, a push-subscription table. No new store is justified by any option.
