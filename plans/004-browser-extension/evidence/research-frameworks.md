# Cross-browser MV3 extension frameworks (research date 2026-10-08)
Method: GitHub REST API and npm downloads API (fetched 2026-10-08, via WebFetch summaries), official docs. UNCONFIRMED = not verified in a primary source. Third-party blogs (extensionbooster.net, mintlify mirrors) are low-trust and flagged.

## Maturity table
| Tool | Stars | Open issues | Last push | Last release | npm dl (5 Sep-4 Oct 2026) |
|---|---|---|---|---|---|
| WXT | 10,583 | 205 | 2026-10-07 | wxt-v0.21.4 2026-08-11 (sub-packages storage/i18n/analytics 2026-10-04) | 2,626,629 |
| Plasmo | 13,165 | 371 | 2026-10-07 | v0.90.5 2025-05-17 | 2,531,820 |
| CRXJS | 4,179 | 20 | 2026-10-06 | vite-plugin-v2.7.0 2026-06-19 | 1,634,399 |
| web-ext | 3,146 | 220 | 2026-10-08 | 10.7.0 2026-09-21 | 949,876 |
| webextension-polyfill | 3,068 | 0 | 2026-07-30 | n/a | 7,843,347 (ARCHIVED) |
Sources: https://api.github.com/repos/{wxt-dev/wxt, PlasmoHQ/plasmo, crxjs/chrome-extension-tools, mozilla/web-ext, mozilla/webextension-polyfill}, /releases, https://api.npmjs.org/downloads/point/last-month/<pkg>, all fetched 2026-10-08.
Notes: Plasmo's repo still gets pushes but has had no tagged release for ~17 months. Plasmo downloads are near WXT's, likely inflated by existing installs and CI (UNCONFIRMED).
mozilla/webextension-polyfill is archived, so avoid it for new work. Firefox supports the `chrome` namespace with callbacks and `browser` with promises (https://extensionworkshop.com/documentation/develop/porting-a-google-chrome-extension/). Chrome MV3 `chrome.*` also returns promises.

## Platform facts (apply to every option)
- Chrome MV3 requires `background.service_worker`; Firefox does not support it (Firefox bug 1573659) and uses `background.scripts`. Cross-browser fix per MDN: declare BOTH in one manifest. Chrome 121+ ignores `scripts`, Firefox 121+ starts the background page regardless of `service_worker`. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background (fetched 2026-10-08)
- Firefox: AMO needs `browser_specific_settings.gecko.id`. Since 2025-11-03 all NEW extensions must declare `browser_specific_settings.gecko.data_collection_permissions` (use `"required": ["none"]` if none); needs Firefox desktop 140+ / Android 142+. https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ (fetched 2026-10-08). Relevant to oldboys: scraped public-profile data likely counts as personal data, so declare it honestly.
- Single zip: Chrome Web Store and Edge Add-ons accept the same MV3 zip (secondary source: https://dev.to/aialleyway/shipping-one-manifest-v3-extension-to-chrome-edge-and-firefox-from-a-single-source-cep, UNCONFIRMED in Microsoft/Google docs). AMO needs its own zip (gecko id, data-collection keys) AND a source-code zip if the build is minified/bundled. WXT docs say the same: https://wxt.dev/guide/essentials/publishing.html. So: 2 artifacts (chromium zip for CWS+Edge, firefox zip + sources zip for AMO). A single hybrid manifest zip might pass all three (UNCONFIRMED; AMO rejects unknown/Chrome-only keys only as warnings in lint, UNCONFIRMED).
- web-ext lint: validates manifest keys, permissions, API usage against a minimum Firefox version. web-ext sign: needs AMO `--api-key`/`--api-secret`; `--channel listed|unlisted` (listed = submit to AMO, unlisted = signed self-distribution copy); `--approval-timeout` default 900000 ms. web-ext build zips; web-ext run temp-installs with auto reload. https://extensionworkshop.com/documentation/develop/web-ext-command-reference/ (fetched 2026-10-08). web-ext is Firefox-centric (it can also run Chromium) and is not a bundler.
- Playwright loads extensions in Chromium only (persistent context, `--load-extension`; the bundled `chromium` channel supports headless). No Firefox extension loading. Google Chrome/Edge removed side-loading flags. https://playwright.dev/docs/chrome-extensions (fetched 2026-10-08). Firefox e2e must go through web-ext run or Selenium/geckodriver (UNCONFIRMED here).

## WXT (https://wxt.dev)
(a) Chrome vs Firefox: `wxt build -b chrome|firefox|edge`, manifest generated from `wxt.config.ts` plus entrypoint options; no source manifest. Docs state default "MV2 for Safari and Firefox and MV3 for all other browsers", override with `--mv3`/`--mv2` (https://wxt.dev/guide/essentials/target-different-browsers.html, fetched 2026-10-08). UNCONFIRMED whether 0.21.x changed this; changelog says v0.21.1 has a breaking change on Firefox default but excerpt was not explicit (https://raw.githubusercontent.com/wxt-dev/wxt/main/packages/wxt/CHANGELOG.md). Verify with `wxt build -b firefox --mv3` before relying on it. Per-browser option objects (`matches: {chrome: [...], firefox: [...]}`), `include/exclude` per entrypoint, `manifest: ({browser, manifestVersion}) => ...` function form (https://wxt.dev/guide/essentials/config/manifest.html). v0.20.22 added Firefox `data_collection_permissions` support; v0.20.21 added page_action for Firefox MV3 (changelog above). Background is `defineBackground({main(){}})`; WXT emits service_worker or scripts per target.
(b) Content-script UI: three modes, integrated, shadow root (`createShadowRootUi`, requires `cssInjectionMode: 'ui'`), iframe (HMR works, no page context). React via `@wxt-dev/module-react`. `ctx` tracks context invalidation; `wxt:locationchange` event for SPAs. https://wxt.dev/guide/essentials/content-scripts.html
(c) Dev loop: Vite HMR, auto-opens browser via web-ext runner (v0.21.0 made `web-ext` a peer dependency; a separate `runner` package shipped 2026-08-11), persistent chromium profile, `web-ext.config.ts`. https://wxt.dev/guide/essentials/config/browser-startup.html
(d) Testing: `WxtVitest()` plugin gives in-memory `@webext-core/fake-browser`, `fakeBrowser.reset()` between tests, auto-import and alias handling. https://wxt.dev/guide/essentials/unit-testing.html. E2E: Playwright against `.output/chrome-mv3`, example repo wxt-dev/examples. https://wxt.dev/guide/essentials/e2e-testing.html
(e) Maturity: see table. 0.x version (not 1.0), frequent breaking changes per minor (0.21.0 breaking list: web-ext peer dep, removal of `url:` imports, zip includeSources semantics, TS 5.4+). Single main maintainer (aklinker1 appears as release author, https://github.com/wxt-dev/wxt/releases/tag/wxt-v0.21.1) so bus factor risk, UNCONFIRMED beyond that.
(f) LLM/agent friendliness: high. File-based `entrypoints/` (zero or one level deep), explicit `defineX` helpers, generated `.wxt/` types, auto-imports (the magic part; can be disabled). `wxt zip`, `wxt zip -b firefox` (also emits sources zip), `wxt submit` for CWS, AMO, Edge. https://wxt.dev/guide/essentials/publishing.html. Constraint: entrypoint files are evaluated in Node at build time, so runtime code must live inside `main`.
(g) Pain: open issues on 2026-10-08 by comment count: ESM content scripts (#357, 39 comments, opened 2024-01-18), dev websocket connection failed (#1362, 2025-01-21), tabs auto-reload on code change (#975, 2024-09-11), Windows terminal Ctrl+C (#1279), Firefox-specific APIs (#1652). https://github.com/wxt-dev/wxt/issues (API search fetched 2026-10-08).

## Plasmo (https://docs.plasmo.com)
(a) Targets `chrome-mv3` (default), `firefox-mv2`, `firefox-mv3` (documented as experimental), plus edge/brave/opera mv3 via Chromium. https://docs.plasmo.com/framework/workflows/faq (fetched 2026-10-08). Manifest derived from package.json `manifest` field.
(b) CSUI: `content.tsx` exporting a React component, Shadow DOM isolation, React/Svelte/Vue. Best-in-class ergonomics. https://docs.plasmo.com/framework/content-scripts-ui
(c) Dev loop: Parcel bundler, not Vite. Reports of unreliable reload (secondary: https://extensionbooster.net/blog/plasmo-alternatives-chrome-extension-framework-migration-guide-2026/, low trust, UNCONFIRMED numbers like "40% manual reloads"). Own issue #664 "Development server usually doesn't update the extension or being extremely slow" (opened 2023-07-06, still open).
(d) Testing: no first-class unit-test story found in docs (UNCONFIRMED); Playwright works for Chromium builds.
(e) Maintenance: last release v0.90.5 on 2025-05-17 (17 months before 2026-10-08), 371 open issues, repo still receives pushes (2026-10-07). Blog claims team focus moved to commercial products (UNCONFIRMED, secondary source). Open bugs: Tailwind v4 breakage #1188 (2025-02-12), TailwindCSS example doesn't build #1156 (2025-01-13). Does not fit Vite-era monorepo, Vitest or React 19 pipeline cleanly (React 19 support UNCONFIRMED).
(f) Magic: high (Parcel conventions, `~` imports, implicit manifest, `contents/` dir). 
(g) Migration reports to WXT: https://www.libhunt.com/posts/1392645-the-journey-of-migrating-our-browser-extension-from-plasmo-to-wxt-framework (date UNCONFIRMED).

## CRXJS (@crxjs/vite-plugin, https://crxjs.dev)
(a) Vite plugin; you write a real `manifest.json`/`defineManifest` yourself. v2.x supports a `browser: 'chrome'|'firefox'` option that rewrites background to `scripts` for Firefox (source: third-party mirror https://www.mintlify.com/crxjs/chrome-extension-tools/config/browser-support, UNCONFIRMED against official README, which only says "cross-browser" and MV3). No built-in Edge target (same as Chrome).
(b) Content-script UI: only HMR for content scripts and bundling; no shadow-root helper, you mount React yourself.
(c) Dev loop: strong Vite HMR including content scripts. No integrated browser launcher (use web-ext run or load unpacked).
(d) Testing: none built in; use plain Vitest with hand-written mocks, Playwright for Chromium.
(e) Maintenance: was near-dead in 2024 (UNCONFIRMED), revived mid-2025 by new maintainers (Toumash, FliPPeDround per secondary source https://extensionbooster.net/blog/wxt-vs-crxjs-chrome-extension-framework-comparison-2026/, UNCONFIRMED). Releases: 2.3.0 2025-12-08, 2.4.0 2026-03-16, 2.5.0/2.6.1 2026-06-11, 2.7.0 2026-06-19. Only 20 open issues. Vite 8 support landed mid-2026 (secondary).
(f) Low magic, explicit manifest, plain Vite; easy for an agent, but you own packaging, zip, sources zip, per-browser manifest forks.
(g) Pain: "Content script fileName is undefined" build error (https://extension.js.org/docs/migrate/crxjs-content-script-filename-undefined, vendor-biased page, date unknown).

## Plain Vite/esbuild + hand-written manifests (+ web-ext)
(a) You write `manifest.chrome.json` and `manifest.firefox.json` (or a small TS merge script producing both with service_worker/scripts and gecko id). Per MDN a single manifest with both background keys also works.
(b) Content UI: you write the shadow-root mount (about 30 lines) with Vite lib/multi-entry or esbuild; content scripts must be single-file IIFE bundles (no ESM in content scripts without tricks), which is the main build gotcha.
(c) Dev loop: `vite build --watch` plus `web-ext run --source-dir dist` (Firefox) or load-unpacked (Chromium); no HMR for extension contexts; reload via web-ext (auto reload).
(d) Testing: Vitest with a tiny hand-rolled `browser` stub or `@webext-core/fake-browser` (the WXT-independent package), Playwright for Chromium.
(e) Maintenance: you own it, but there is no framework risk. webextension-polyfill is archived; avoid, use `chrome.*` promises or `@types/chrome`.
(f) Most explicit, zero magic, but more boilerplate for an agent to get wrong (manifest paths, zip, sources).
Packaging: `web-ext build`, `web-ext lint`, `web-ext sign`, `chrome-webstore-upload-cli` for CWS (UNCONFIRMED here).

## web-ext (Mozilla)
Not a framework. Use with any option: lint (pre-submit gate), run (Firefox dev loop with reload), build (zip), sign (AMO signing, needs API key/secret). v10.7.0 released 2026-09-21, 220 open issues, active. Peer dependency of WXT since 0.21.0.

## Ranking for oldboys (single TS codebase, pnpm, Vite-era, Vitest, Zod, React 19; Chrome+Edge+Firefox)
1. WXT. Best match: Vite, Vitest plugin with fake-browser, React module, shadow-root helper, per-browser build and zip, store submit, web-ext built in. Risks: 0.x breaking changes (pin the version), verify Firefox MV3 default, single-maintainer risk.
2. Plain Vite + hand-written manifests + web-ext. Safest long-term and most explicit; costs a day of build plumbing (content-script IIFE, dual manifest, sources zip). Pick if the extension is small (one content script, one background, one popup).
3. CRXJS. Great HMR, active again since 2025, but you build packaging and shadow-root yourself and Firefox support evidence is secondary-source.
4. Plasmo. Skip: no tagged release since 2025-05-17, Parcel not Vite, 371 open issues, Tailwind v4 breakage open since 2025-02.
web-ext complements 1-3 (lint, run, sign); it is not a competitor.

## Open items to verify before committing
- Does `wxt build -b firefox` default to MV2 in 0.21.4 (docs say so); use `--mv3` and check Firefox 140+ loads it.
- Whether one hybrid-manifest zip passes AMO review (with gecko id) and CWS (extra gecko keys are ignored with a warning, UNCONFIRMED).
- Edge accepts the Chrome zip unchanged (secondary source only).
