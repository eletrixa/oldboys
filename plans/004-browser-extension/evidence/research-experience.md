# Experience reports: cross-browser MV3 extension + backend job system (2023-2026)
Researched 2026-10-08. Evidence grade: A = primary/vendor doc or first-hand dev report; B = HN comment/issue by practitioner; C = SEO/marketing blog, no first-hand evidence (use as pointer only).

## 1. MV3 service worker in production
PRAISE
- Lifetime now extends with activity (A): 30s idle, 5 min per-event, 30s per-fetch; timers reset by extension API calls (Chrome 110), offscreen messages (109), ports (114), WebSocket messages (116), debugger (118). Alarm min period 30s (120). https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Official WebSocket keepalive pattern is blessed: ping every 20s, minimum_chrome_version 116. https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets
- Persist-in-storage pattern works: Adblock Plus moved state to storage.session (1MB quota), replaced setInterval/setTimeout with alarms, avoided intervals under 60s because alarms get less reliable. https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui/-/issues/1070 and /1071 (undated in fetch)
- InfoDiet (HN, 2026-07-21): storage.sync persistence plus 1-minute alarm resync of tab state on wake. https://news.ycombinator.com/item?id=48999462 (B)
PAIN
- "Service workers go to sleep whenever Chrome feels like it": needed alarms 30s + WebSocket PING/PONG 15s + exponential backoff reconnect 1s-60s. Ariadne, HN 2026-03-02. https://news.ycombinator.com/item?id=47219043 (B). Even after the 2023 improvements, teams still stack three layers.
- Long fetch/XHR can be killed at 30s; no standard signal. W3C WECG issue #1016, opened 2026-05-30, open, needs-triage. https://github.com/w3c/webextensions/issues/1016 (A)
- Long work is killed with no error signal; keep-alive alarms "reduced but didn't eliminate" failures; offscreen docs "have their own lifetime", shifts the problem. WECG #1014, 2026-05-28. https://github.com/w3c/webextensions/issues/1014 (A)
- Unfixed older reports: SW shut down every 5 min, crbug 1152255 (HN 2022-12-06). https://news.ycombinator.com/item?id=33877659
- Alarms silently not firing reported in practice; Adblock Plus notes known Chromium alarm bugs (same 1071 issue). A direct Reddit thread was not retrievable (see negatives).
- Events must be registered synchronously at top level or they miss the wake (C: extensionbooster debugging guide, repeats Chrome docs).
POLICY-SAFETY of workarounds
- Offscreen: docs list 15 reasons (TESTING, AUDIO_PLAYBACK, DOM_PARSER, WORKERS, ...); only AUDIO_PLAYBACK has a lifetime cap (30s without audio). The doc states NO policy on using offscreen purely for keepalive. https://developer.chrome.com/docs/extensions/reference/api/offscreen (A). Using it with a made-up reason is a Web Store review risk; unverified, no incident found.
- Ping-while-WebSocket-open and alarms are documented/blessed. A published "MV3keepAlive" store extension exists (https://chromewebstore.google.com/detail/dnpicagigpocioedhbidlikohomefllp) so hacky keepalive survives store review, but that is not a policy statement.

## 2. Firefox MV3
PRAISE
- Firefox ships event pages (background.scripts), keeps DOM/WebAPI access in background, keeps blocking webRequest and DNR. Mozilla blog 2022-10-31 https://blog.mozilla.org/addons/2022/10/31/begin-your-mv3-migration-by-implementing-new-features-today/ (A)
- HN dev (2025-01-06): Chrome MV3 "surprisingly straightforward", Firefox "clunkier and more dated"; Edge port took minutes, Microsoft Store publishing a "nightmare". https://news.ycombinator.com/item?id=42606222 (B)
- Another dev built Firefox first, then Chrome; identical core (2023-01-16). https://news.ycombinator.com/item?id=34396532 (B)
PAIN
- All MV3 permissions incl. host permissions are opt-in in Firefox; need permissions.onAdded/onRemoved handling and a UI path to request. Mozilla blog above (A).
- Manifest: background with both service_worker and scripts broke background start in Firefox before 121 (bugzilla 1860304, status not fetched); Chrome historically rejected "scripts" (crbug 1418934 to downgrade to warning). Common practice: separate manifest per browser. Search summary only (C-B); verify on MDN background page.
- Alarms: Firefox alarms do not persist across extension restart; fire early after sleep and shift later ones. Mozilla Discourse 2022-12-16. https://discourse.mozilla.org/t/inconsistency-of-the-alarms-api/108906 (B)
- Firefox WECG #1016/#1014 open questions on how event pages behave for long requests: no comparison data published.
- Code sharing: WXT claims one codebase for Chrome/Firefox/Edge/Safari (skills.sh summary, C). No first-hand postmortem found beyond the Plasmo->WXT migration post https://chatgptwriter.ai/blog/migrate-plasmo-to-wxt (HN 41728875, 2024-10-03; content not fetched).

## 3. Polling vs push for job status
- Polling via alarms is the default for indie tools. Alarms min 30s (Chrome 120+), practitioners avoid under 60s (ABP). Fine for a job that takes minutes; side panel/popup open can poll faster with setInterval because the page is alive. (A/B)
- WebSocket: works since Chrome 116 with 20s ping but "cannot wake a suspended extension" (C: extensionbooster). Needs reconnect/backoff (Ariadne).
- Web Push: Chrome docs: supported in MV3 extensions, push wakes the SW, Chrome 121 allows userVisibleOnly:false (silent push), needs notifications permission (adding it disables existing installs until approved), routes via FCM. https://developer.chrome.com/docs/extensions/how-to/integrate/web-push (A, updated 2024-02-05)
- Firefox: no service workers in extensions, so no PushManager from background; fallback is a WebSocket/third-party connection from the persistent-ish event page (search snippet from MDN/Mozilla Discourse, unverified deeper). No first-hand "we shipped Web Push in an extension" report found.
- chrome.gcm still works, 4KB payload, legacy (C).
- SSE/EventSource: Chrome docs contain no guidance. No production report found. Treat as untested; fetch-streaming is bounded by the 30s fetch rule unless data flows (unverified whether chunks reset timer; WECG #1016 suggests not).

## 4. Agentic era
- Hallucination patterns (C, extensionbooster 2026-07-18, opinion, not first-hand): persistent background pages, localStorage in SW, setInterval for periodic work, blocking webRequest, DOM in SW, eval/CDN scripts, bundled API keys, "background.scripts" block means V2. https://extensionbooster.net/blog/260718-chrome-extension-development-ai-age-agent-skills/
- Same family of guides: models trained on pre-2023 docs suggest V2; long sessions double down on early mistakes -> fresh chat (C, qwe.edu.pl tutorial).
- Claude-Code-built extensions are showing up on HN (Show HN: Claude Tuner 2026-03-10, Ariadne 2026-03-02, Pablo 2026-05-22 https://news.ycombinator.com/item?id=48237415), and the offscreen-doc / storage-persistence lessons are learned by the builders, not by the agent upfront. No quantified hallucination study found.
- WXT/Plasmo for agents: WXT file-based entrypoints + typed `browser` + auto-imports + `.wxt/types`; skills.sh "chrome-extension-wxt" skill exists. No first-hand report that WXT conventions help or confuse agents (negative result). Auto-imports are a plausible agent confusion point (WXT docs warn you must mock real import paths, e.g. `#imports`) - inference, not reported.
- Testing without a human: WXT bundles Vitest plugin + @webext-core/fake-browser (in-memory storage, reset()) https://wxt.dev/guide/essentials/unit-testing.html (A). Playwright: persistent context + --load-extension, channel 'chromium' for headless, SW id from serviceWorker URL, evaluate in flight during suspend throws "Service worker restarted". https://playwright.dev/docs/chrome-extensions (A). Chrome/Edge branded builds removed side-load flags -> use bundled Chromium. Firefox: no equivalent found in docs read (web-ext run exists but not covered by my sources).
- Agent iteration loop recommendation inferred: fake-browser for logic, Playwright against built output for wiring, a test that kills the SW (chrome://serviceworker or CDP) to prove state restore. Not from a source.

## 5. Token-authenticated extension
- Practitioner consensus: backend proxy best, chrome.storage next-best; storage is unencrypted on disk (Chrome docs warning; Mozilla Discourse 24650 "no absolutely safe way"). OpenAI forum Dec 2024 https://community.openai.com/t/chrome-extension-and-api-key-security/1047047 (B)
- OAuth: chrome.identity only for Google; generic OAuth needs launchWebAuthFlow, not Firefox-identical (C: extensionbooster auth guide, not fetched).
- Incidents: Unit 42 research on malicious AI extensions that exfiltrate prompts/keys; my search only returned spam mirrors, original not verified. Generic "extensions leaking hard-coded keys" posts are C-grade.
- Options page paste is the dominant indie pattern; no postmortem of a leaked pasted token or rate-limit incident found.

## Negative results
- HN Algolia: no hits for "extension API key leaked OpenAI", "Plasmo abandoned", "firefox manifest v3 service_worker" as stories.
- No Reddit/Lobsters threads retrievable (web search surfaced none directly); Reddit coverage is zero.
- No first-hand report of Web Push, SSE or EventSource running in a production extension.
- No report on offscreen-for-keepalive being rejected or accepted by Web Store review.
- No empirical agent-vs-WXT/Plasmo comparison.
- Search tool is US-only snippet summaries; several claims above rest on snippets and are labeled.
