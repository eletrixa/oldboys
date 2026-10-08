# oldboys browser extension

Mark a person on LinkedIn (button on `/in/*` pages) or anywhere (select a name, right-click, "Research with oldboys"). The research runs on the oldboys Worker; the extension polls once a minute and shows an OS notification when the sourced report is ready or when the run needs you to pick the right namesake. Click the notification to open the report.

One codebase, built with [WXT](https://wxt.dev): Chrome and Edge load `.output/chrome-mv3`, Firefox loads `.output/firefox-mv3`.

## What it reads from the page
Only the profile URL, the visible name (`<h1>`, falling back to the tab title) and the visible location line. Nothing else leaves the page; no automation, no cookies, no gated fields. The server researches public sources through Apify actors; it never fetches linkedin.com. Raw data is purged after judging.

## Run it
```
pnpm --filter oldboys-extension build            # Chrome + Edge → extension/.output/chrome-mv3
pnpm --filter oldboys-extension build:firefox    # Firefox      → extension/.output/firefox-mv3
pnpm --filter oldboys-extension zip              # store zips (firefox: zip:firefox, also emits sources zip)
```
Chrome / Edge: `chrome://extensions` → Developer mode → Load unpacked → `extension/.output/chrome-mv3`.
Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → any file in `extension/.output/firefox-mv3`.

Open the popup once, paste the run token (`RUN_TOKEN`), pick the goal. API base defaults to `https://oldboys.asajj.cz`; set `http://localhost:3141` against `pnpm dev`.

## Check
`pnpm --filter oldboys-extension check` (typecheck, lint, Vitest with WXT's fake browser). The root `pnpm check` includes it.

## Known limits
- Polling is 60 s; a notification can be up to a minute late. Opening the popup and pressing Refresh reconciles immediately.
- Firefox notifications have no buttons; the badge count is the always-on signal.
- The token is stored in `storage.local` (unencrypted). The server caps runs per hour.
- Report pages are reachable by their UUID without login (hackathon scope).
