# MV3 cross-browser extension: official-doc facts (fetched 2026-10-08)
Dates are the page's own "last updated/modified" where shown. Fetch tool summarises pages, so quotes are as returned by it.

## 1. Chrome MV3 service worker lifecycle
- Termination triggers: "After 30 seconds of inactivity. Receiving an event or calling an extension API resets this timer."; "When a single request, such as an event or API call, takes longer than 5 minutes to process."; "When a fetch() response takes more than 30 seconds to arrive."
  https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle (updated 2023-05-02)
- Keep-alive: extension API calls (Chrome 110+), active WebSocket traffic (116+), long-lived messaging ports (114+), offscreen doc messages (109+), connectNative (105+), permissions.request-style prompts (116+). Same page.
- EventSource/SSE: NOT mentioned on lifecycle or real-time pages. UNCONFIRMED that an SSE stream keeps the worker alive; by the 30 s fetch-response rule and absence from the keep-alive list, assume it does not. WebSocket is the documented exception.
- Real-time page: "Chrome suspends extensions that are not being used after 30 seconds"; recommends heartbeats for WebSockets; Push API wakes a suspended worker. https://developer.chrome.com/docs/extensions/develop/concepts/real-time (updated 2023-12-20)
- chrome.alarms: "setting delayInMinutes or periodInMinutes to less than 0.5 will not be honored and will cause a warning"; "when you've loaded it unpacked, there's no limit to how often the alarm can fire." Before Chrome 120 the limit was 1 minute (MDN alarms/create, modified 2026-04-27). persistAcrossSessions exists from Chrome 150; for older versions re-create alarms on worker startup.
  https://developer.chrome.com/docs/extensions/reference/api/alarms (updated 2026-10-04)
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms/create
- Implication: polling every 30 s via alarms works in a packaged build; sub-30 s polling only works unpacked or while something keeps the worker alive.

## 2. Firefox MV3
- No service worker: "Firefox does not support background.service_worker (bug 1573659)". Supports background.scripts / page, non-persistent only in MV3.
- Both keys in one manifest work: Chrome uses service_worker, Firefox uses scripts. Firefox <120 did not start the background if service_worker was present (bug 1860304); fixed from 121. Chrome <121 refused to load MV3 with background.scripts; from 121 it is ignored. persistent:true in MV3 is an error.
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background (modified 2026-09-05)
- Event page lifetime: "Background scripts unload after a few seconds of inactivity"; open extension views keep it alive; message ports do not. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts (modified 2026-07-27). Exact seconds UNCONFIRMED.
- gecko.id: "Required for signing extensions through AMO or self-distribution" in MV3. gecko.data_collection_permissions mandatory for new AMO submissions since 2025-11-03 (use {"required":["none"]} if none).
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings (modified 2026-04-20)
- host_permissions: "optional and not automatically granted at install time"; from Firefox 127 listed hosts are shown in the install prompt; use permissions.request() otherwise; updates adding hosts are not shown. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions (modified 2026-04-21)
- Alarms: MDN alarms/create does not state a Firefox minimum (UNCONFIRMED; a search snippet claimed <1 min is clamped to 1 min, not verified on the page). Alarms do not persist across browser sessions (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms, 2025-07-17).
- notifications: create, clear, getAll, update, onClicked, onButtonClicked, onClosed, onShown exist. NotificationOptions: "Firefox currently only supports type, title, message, and iconUrl; and the only supported value for type is 'basic'"; appIconMaskUrl and isClickable unsupported. So no buttons, no requireInteraction. "If you call create() more than once in rapid succession, Firefox may end up not displaying any notification."
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/NotificationOptions , .../notifications/create (2025-07-17)
- declarativeNetRequest: not needed; not researched further.

## 3. Edge
- "The Extension APIs and manifest keys supported by Chrome are code-compatible with Microsoft Edge." Steps: check API support list, remove update_url, do not use "Chrome" in name/description (certification), sideload to test. Publish via Microsoft Edge Add-ons (separate dev account). Native messaging allowed_origins must use the Edge catalog ID.
  https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension (updated 2026-08-12)
- Not verified: exact Edge API-support gaps for alarms/notifications/sidePanel (UNCONFIRMED; check .../api-support).

## 4. chrome.notifications and badge
- Needs "notifications" permission. create() + onClicked (fires for non-button area). requireInteraction (Chrome 50+) keeps it visible until user acts, default false. Up to two buttons; templates basic/image/list/progress. macOS: image URLs and icon masks not shown, list shows first item only. Windows/Linux/Mac: priority -2 and -1 error. https://developer.chrome.com/docs/extensions/reference/api/notifications (updated 2026-09-21)
- OS-level suppression (macOS Focus, Windows Focus Assist) not covered by the doc: UNCONFIRMED from official docs.
- Click-to-open-tab via chrome.tabs.create inside onClicked in the worker: not shown on that page; standard pattern, no gesture needed for tabs.create. UNCONFIRMED in text.
- Badge: action.setBadgeText sets text over the icon; "only about four [characters] can fit". Needs "action" key (optional). https://developer.chrome.com/docs/extensions/reference/api/action (updated 2026-09-11). Firefox browserAction has the same API (not re-fetched).

## 5. Web Push in extensions
- Chrome: worker receives Push API messages and is woken if suspended; needs "notifications" permission; from Chrome 121 userVisibleOnly:false allowed (silent push); applicationServerKey is a VAPID public key; any push provider, FCM routes Chrome; self-host via web-push library. chrome.gcm is legacy.
  https://developer.chrome.com/docs/extensions/how-to/integrate/web-push (updated 2024-02-05), https://developer.chrome.com/docs/extensions/develop/concepts/real-time (2023-12-20)
- Chrome blog URL /blog/web-push-for-extensions returned 404; announcement date not confirmed (UNCONFIRMED "Chrome 116").
- Firefox: Push exists for service workers/pages (bug 1038811, Fx 40); no evidence found of PushManager in WebExtension event pages. UNCONFIRMED, treat as unavailable.
- Viability: Chrome/Edge only, needs push subscription endpoint + VAPID server; Firefox still needs polling. Polling remains the cross-browser baseline.

## 6. Side panel / sidebar
- Chrome sidePanel: Chrome 114+, "sidePanel" permission, "side_panel.default_path"; panels are extension pages with full API access; open() needs a user action and tabId or windowId; onOpened Chrome 141+, onClosed/close() 142+. https://developer.chrome.com/docs/extensions/reference/api/sidePanel (updated 2026-09-11)
- Firefox: sidebarAction + "sidebar_action" key (Firefox only; Chrome uses sidePanel). open/close/toggle/isOpen exist. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/sidebarAction (2025-07-17)
- EventSource in a popup/sidepanel page: page context so it is a normal window; lives while the page is open. Popup closes on focus loss; side panel persists. No doc sentence found stating this directly (inference, UNCONFIRMED in text). Firefox: open extension views keep the event page alive.

## 7. CORS / fetch
- Chrome: "A script executing in an extension service worker or foreground tab can talk to remote servers outside of its origin, as long as the extension requests host permissions." Content scripts are bound by same-origin policy; use message passing to the worker. https://developer.chrome.com/docs/extensions/develop/concepts/network-requests (updated page, date not shown by fetch)
- Firefox MV3: host permissions do not lift CORS in content scripts; background/extension pages work. Content script fetch/XHR in MV3 runs in page context and "Don't set the Origin header" per MDN's privileged-instance note. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts (modified 2026-09-25)
- Origin header value from the worker (chrome-extension://<id>) : UNCONFIRMED in official docs. Server should not rely on Origin; use bearer token. Still send CORS headers if any call happens in a page context.

## 8. Storage
- storage.local: 10 MB (5 MB in Chrome 113-), unlimitedStorage lifts it; persists until uninstall. storage.session: in-memory, 10 MB (1 MB in 111-), cleared on disable, reload, update, browser restart. sync: ~100 KB, 8 KB/item. Content scripts and worker both reach storage; setAccessLevel controls session exposure. Worker cannot use Web Storage (localStorage).
  https://developer.chrome.com/docs/extensions/reference/api/storage (date not shown by fetch)
- Firefox storage.local limits: not researched, UNCONFIRMED.

## 9. Store policies
- CWS single purpose: "An extension must have a single purpose that is narrow and easy to understand." Limited use: "may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose"; no sale to advertisers/brokers or credit assessment; human access restricted.
- CWS remote code (MV3): "The full functionality of an extension must be easily discernible from its submitted code." Banned: eval(), remote scripts, logic-containing external resources.
  https://developer.chrome.com/docs/webstore/program-policies/policies (updated 2025-05-22)
- CWS user-data FAQ: disclosure required even for local processing, including "clipping or scraping content from a website... such as taking screenshots or capturing data"; privacy policy and HTTPS/WSS required; Limited Use bans personalized/retargeted ads. https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (page dated 2016-04-23)
- No CWS rule found that bans scraping as such; LinkedIn's own ToS on scraping is out of scope here and is the larger risk (UNCONFIRMED here, not researched).
- AMO: "Add-ons must be self-contained and not load remote code for execution."; no obfuscation, minification allowed with source submission; data transmission limited to what is necessary, with consent; Firefox 140+ built-in consent must match manifest data_collection_permissions. https://extensionworkshop.com/documentation/publish/add-on-policies/ (updated 2026-04-30)
