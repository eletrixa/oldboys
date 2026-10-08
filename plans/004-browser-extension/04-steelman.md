# 04 — Steelman court

Six independent agents (no shared context) argued each option; cross-examination written by the synthesiser. Evidence pack: `01-deep-dive.md`, `02-case-studies.md`, `evidence/`, `docs/06-extension-pre-mortem.md`.

---

## Option A

### Advocate

# The case for Option A, "Launcher"

1. **It is the only option sized for a night where the core product must win.** The pre-mortem's top launch-blocking risk is that the extension eats the core (pre-mortem T1). The jury scores value 35 and originality 25. Option A costs about one person-night, with roughly 60 lines of Worker delta (options, Option A "Cost"). It also fits the pre-mortem's time-box of one person for 3 h, with the video cut working without it (pre-mortem Go/No-Go).

2. **Polling is the one completion channel that works in all three browsers.** Chrome's service worker dies after 30 s idle, and a fetch response taking over 30 s also kills it (mv3-docs §1). Firefox has no service worker and unloads its event page within seconds (mv3-docs §2). Alarms with a 30 s floor are the shared timer (options, shared facts). Web Push in extensions is Chrome-only, and no production report exists (experience §3, negative results). SSE in an extension is untested (experience §3). Polling is also the indie default (experience §3).

3. **It sidesteps the failure modes that keep recurring in the evidence.** Builders still stack alarms, pings and backoff to keep MV3 workers alive (experience §1, Ariadne). Offscreen-document keepalive has no stated policy, and no store review precedent exists (experience §1). Option A keeps no connection open. It persists run state in `storage.local` and lets an alarm wake the worker, which is the documented pattern (experience §1, Adblock Plus). Registering listeners at top level is cheap discipline (experience §1).

4. **It has the smallest policy and legal surface of the extension options.** Reading only URL, name and location, with one explicit user click, is "the lowest-risk design seen" (case-studies, Implications 1 and 3). The Kaspr fine came from reading data visible only to logged-in users (case-studies, Kaspr). Minimal permissions and a context menu that works on any page are explicitly recommended (case-studies, Implications 4). Chrome Web Store single-purpose and Limited Use rules fit a launcher whose whole function is easy to discern (mv3-docs §9). Option B must also solve CSP for framing the app inside the extension (options, Option B). That is extra review surface.

5. **It maps cleanly onto how the market actually builds.** Clay's "Clip to Clay" has the same shape: the client captures identity and the backend enriches (case-studies, Clay). Hunter ships Chrome, Edge and Firefox from one tree (case-studies, Hunter). The Edge build is the Chrome zip (mv3-docs §3, pre-mortem Paper Tigers). Case-studies Implications 6 says a multi-minute job needs "run id, then badge/notification, then link to the report". That is the definition of Option A.

6. **The toolchain de-risks it, and the design is agent-friendly.** WXT ranks first for this stack (frameworks, Ranking). It generates both `service_worker` and `scripts` manifests per target, which removes the Firefox 4 am divergence risk (pre-mortem T5). It gives a Vitest plus fake-browser seam for the pure functions `parseProfile`, `nextPoll` and `transition` (frameworks, WXT (d); options, Option A "Test seams"). Agent-hallucination hotspots such as persistent pages, `setInterval` and DOM in the worker are structurally absent (experience §4).

7. **It evolves without rewrites.** The status JSON route serves the popup, the notification and later inline lineup answers. Web Push can be added on Chrome as a faster path, with alarms as the fallback (options, Option A "Evolution"). Option C's push infrastructure could later sit under A as well (options, Option C "Evolution").

**Conceded weaknesses, reframed**
- **Latency of 30 to 60 s.** Research runs take minutes, so a 30 s tick is invisible (experience §3). Sub-60 s polling is flaky on some Chromium builds (experience §1, Adblock Plus), so poll at 60 s as a safe default.
- **Firefox is thinner.** Notifications have no buttons, and alarms don't persist across restarts (mv3-docs §2, §1). Re-creating the alarm on startup and the always-on badge cover both (pre-mortem T9).
- **The token sits in `storage.local`.** This is real (pre-mortem T4). Per-run and per-token caps are enforced in the Worker, not the extension.
- **It adds no value points.** It is a reach play (pre-mortem Elephant 1). That is why it must be cheap, and A is the cheapest.

Strongest single point: Option A is the cheapest design that delivers a notify-on-done experience in all three browsers, using only mechanisms the platform documents (mv3-docs §1, §2; experience §3).

### Prosecutor

1. **The polling loop is built on the least reliable primitive in the stack.** The design depends on alarms firing every 30 to 60 seconds. Adblock Plus avoids intervals under 60 s because alarms get less reliable, and it cites known Chromium alarm bugs (research-experience.md §1). Firefox alarms do not persist across restarts and fire early after sleep (research-experience.md §2; research-mv3-docs.md §2). Chrome's `persistAcrossSessions` only arrives in version 150 (research-mv3-docs.md §1). The pre-mortem's T3 mitigation is therefore a hope, not a guarantee. Its checklist item "verified after service worker unload" tests only the happy path.

2. **The notification is the entire product, and it is the weakest link.** On Firefox it has no buttons and no `requireInteraction`, and rapid successive `create()` calls may show nothing (research-mv3-docs.md §2 and §4). OS Focus modes can suppress it, and the docs do not cover this (research-mv3-docs.md §4, marked UNCONFIRMED). The pre-mortem rates the suppression risk only as a "track" tiger, T9. Its fallback is a four-character badge, which cannot say "needs answer". The `paused` lineup case needs a human, and Option A defers inline answering to a later evolution step (03-options.md, Option A "Evolution").

3. **The Firefox path is unproven and untestable overnight.**
   - **Test coverage:** Playwright loads extensions in Chromium only, so Firefox gets one manual `about:debugging` check at T+7h (research-frameworks.md "Platform facts"; 06-extension-pre-mortem.md T5).
   - **Event-page behavior:** nobody has data on how it handles a long-lived poll (research-experience.md §2).
   - **WXT default:** it may still build Firefox as MV2, and the research itself says "verify" (research-frameworks.md "Open items").
   - **Manifest risk:** the hybrid manifest zip is unconfirmed for AMO (research-frameworks.md "Platform facts").
   - **Ship decision:** "Ship Firefox" is therefore a claim without a test.

4. **The agent-legibility costs are real, though none is measured.** WXT is 0.x with a breaking-change list on every minor release and a single main maintainer (research-frameworks.md WXT (e)). Auto-imports and the rule that entrypoint files run in Node at build time are both traps for a model. WXT's own docs warn that you must mock real import paths (research-experience.md §4). The agent-hallucination list (MV2 patterns, `setInterval`, `localStorage` in the worker) is low-grade evidence (research-experience.md §4, grade C). A sleepy agent at 4 am is the realistic reader of this code. *The size of the effect is rhetoric; the direction is cited.*

5. **LinkedIn exposure is larger than "three visible fields" admits.**
   - **Detection:** BrowserGate alleges LinkedIn probes for thousands of extension IDs, so an installed LinkedIn-touching extension is detectable (research-case-studies.md §6).
   - **Terms:** LinkedIn's help page bans browser extensions that "modify the appearance of" the site. A shadow-root button arguably does exactly that (research-case-studies.md §6).
   - **Selector fragility:** the `<h1>` selector is fragile and tied to LinkedIn's DOM (06-extension-pre-mortem.md T6).
   - **Headline entry point:** the pre-mortem's own elephant 2 says the headline button sits on the one page whose actor may be dead.

6. **The ops and security surface grows with every user.**
   - **Token exposure:** the shared bearer token sits in unencrypted `storage.local`, and one leak means unbounded spend (06-extension-pre-mortem.md T4; research-experience.md §5).
   - **Polling cost:** a quoted load of 2 polls per minute per run is a cost the owners flagged themselves (06-extension-pre-mortem.md T8).
   - **Public reports:** reports are public by UUID because the notification click carries no session. The reports contain sourced claims about real people (06-extension-pre-mortem.md T7 and elephant 4). The case studies show regulators punishing weak data-subject transparency (research-case-studies.md, Kaspr).

7. **It spends the night's scarcest resource on the lowest-scoring axis.** The pre-mortem says this directly: the extension is "a 25% originality play, not a 35% value play" and adds no identity, goal or provenance logic (elephant 1). T1 names the same risk. The ~1 person-night estimate (03-options.md Option A "Cost") equals the entire budget of a three-person, one-night team, and the Worker deltas come on top. Option C delivers completion notification at half the cost with no MV3 risk (03-options.md, Option C).

Strongest single point: Option A's only job is to tell the user a run finished, and it does that through the two least dependable browser primitives (alarms and notifications) on a Firefox path nobody can test overnight.

---

## Option B

### Advocate

**The case for Option B, "Panel"**

The extension should be a window onto the product, not a second product. Here is the case.

1. **Reuse beats rebuild, and the jury scores the core.** The pre-mortem says the extension "adds none" of identity resolution, goal logic or provenance, "it adds reach" (06-extension-pre-mortem, Elephants #1). Value and originality carry 60% of the score. The panel shows the app's own live claims, FACT/INFERENCE split and lineup next to the profile, so the extension's pixels are the core's pixels. Option A's popup shows only a status queue and sends the user away to see the substance (03-options, Option A). *Partly rhetoric on scoring weights; the weights come from the brief.*

2. **Smallest extension-specific surface, smallest T1 risk.** T1, "Extension eats the core", is rated H/H (pre-mortem, Launch-blocking Tigers). B costs about 0.5 person-night against A's 1, and its test surface is "tiny" (03-options, Option B, Cost and Test seams). Almost nothing in the extension can drift from the app, because it hosts the app. The T1 gate (no extension commit before T+5h) is easy to honor when the extension is mostly a frame.

3. **It sidesteps the MV3 hazards that dominate the evidence.** The worker problems are 30 s idle, 30 s fetch cutoffs and "stack three layers" keepalives (research-experience §1; research-mv3-docs §1). The pre-mortem's T3 exists because SSE cannot live in the worker. In B the SSE lives in a page context that is alive while the panel is open. A side panel persists, unlike a popup (research-mv3-docs §6, flagged there as inference). The worker is only "context menu + open panel". It carries no polling logic or alarm re-registration, which is where A inherits the failure modes in research-experience §1. Experience reports also found no production use of SSE in a worker (research-experience §3, Negative results).

4. **Honesty and the brief's hard rules fit naturally.** The case studies' strongest advice is to read three visible fields and do everything else server-side (research-case-studies, Implications 1-4). B's content script only prefills a form, and the user presses Run. That is one-click, user-initiated, with no cookies and minimal host permissions. Because the panel is the app's own UI, provenance links, the CACHED label and the "purged after judging" notice appear as they do in the app, with no re-implementation drifting out of sync.

5. **The demo is the product.** In the video, the user opens a profile, clicks, and watches claims arrive live beside it. This is the end-to-end 20% on screen. A's notification-and-popup story is weaker on video. The Kaspr, Lusha and Seamless case studies show inline, in-context results are the norm. Seamless moved to the Chrome side panel in Nov 2024 because the fly-out covered the page (research-case-studies, Seamless and v1 feature sets). B matches that direction.

6. **Evolution is additive.** 03-options says it plainly: "add a background poller later for notify-when-closed (which is Option A)". B is the base layer and A is a later increment. The reverse path is not free, because A's popup is a rewrite of the view, not an upgrade.

7. **Cross-browser story is honest and bounded.** WXT is the recommended tool (research-frameworks, Ranking) and generates both manifests. Firefox is a sidebar variant with its own risk, scoped to a single T+7h check (pre-mortem T5). *Rhetoric: the claim that this is cheaper than A's Firefox work is not evidenced.*

**Concessions, reframed**

- **Notify-when-closed is lost.** Notifications fire only while the panel is open. Reframe: the runs take minutes and the user is watching a live ledger, which is the product's point. A later alarm poller restores the closed case (03-options, Evolution). The honest cost is that a closed panel gets no signal.
- **Firefox sidebar is unverified.** 03-options says to add Firefox "once `sidebar_action` layout is verified". Reframe: the pre-mortem already limits Firefox to one temporary-add-on check, and Chrome plus Edge is a complete demo. Cases show Firefox lags everywhere except Hunter (research-case-studies §5).
- **CSP and iframe are the real risk.** The `frame-ancestors chrome-extension:, moz-extension:` header is untested, and the integration is "only testable by a human or Playwright Chromium" (03-options, Option B). Also, extension origins are per install, so the allowlist may need a broad pattern. Reframe: bundling a React copy of the run view is the escape hatch the option already names. One header and one spike settle this early. *Rhetoric: that the spike is cheap is my estimate.*
- **Auth and token exposure.** The pre-mortem's T4 and T7 (token leaks, notification click with no session) apply to B too, only less so. An iframe on the app's own origin can reuse the app's session and avoid bundling a token. *Uncited design inference.*

Strongest single point: B makes the extension a window onto the one thing the jury scores most, the live, sourced, FACT/INFERENCE-split report, while taking on the least browser-platform risk.

### Prosecutor

**Prosecution of Option B "Panel"**

1. **It breaks the user's promise.** The promise is "it informs you when the profile is complete". Option B fires notifications only "while it is open" and leaves the background "near-empty" (`03-options.md`, Option B, Essence). A research run takes minutes, and people close panels. The closed-panel case is the main case. The option's own Evolution line fixes this by adding "a background poller... (which is Option A)". The pre-mortem has already seen this failure: T3 requires alarms polling because the worker dies and "nobody is told" (`06-extension-pre-mortem.md`, T3). Option B ships without that mitigation. The Go/No-Go item "Alarms-based polling verified" cannot be met by this design.

2. **sidePanel is gated and Chrome-only.** `sidePanel.open()` needs a user action and a tabId or windowId, and the API needs Chrome 114+ (`research-mv3-docs.md` §6). The flow is content-script button, then background, then panel (`03-options.md`, Option B diagram). The docs don't say whether a gesture survives a `runtime.sendMessage` hop. The "near-empty" background therefore carries the riskiest call in the design. This is untested, and I found no source on it (rhetoric).

3. **Firefox needs a different panel API.** Chrome uses `sidePanel` and Firefox uses `sidebar_action` (`research-mv3-docs.md` §6). The case studies say to "avoid chrome.sidePanel" for Firefox (`research-case-studies.md`, Implications 7). Option B defers Firefox "once `sidebar_action` layout is verified" (`03-options.md`, Option B, Evolution). That defeats the one-codebase, three-browser requirement. Firefox host permissions are also opt-in (`research-mv3-docs.md` §2), which adds a prompt path. Hunter ships all three browsers with a popup (`research-case-studies.md`, Hunter).

4. **The iframe security story doesn't hold.** The diagram sets `frame-ancestors chrome-extension:, moz-extension:`. The pre-mortem says extension origins are per install, so "an allowlist is impossible" (`06-extension-pre-mortem.md`, Paper Tigers). A scheme-only rule lets any installed extension frame the app, which is a clickjacking surface (rhetoric). The iframe also needs the bearer token. Passing it by `postMessage` or app storage is unspecified, and third-party storage partitioning may break the second route (rhetoric). Store policy adds review risk. Chrome Web Store (CWS) wants functionality "easily discernible from its submitted code", and Mozilla's add-on site (AMO) wants add-ons "self-contained" (`research-mv3-docs.md` §9). A remote-page shell invites that scrutiny.

5. **The test story is thin.** Option B admits the integration risk "is only testable by a human or Playwright Chromium" (`03-options.md`, Option B, Test seams). Playwright cannot load Firefox extensions (`research-frameworks.md`, Platform facts). The fake-browser Vitest layer covers nothing in an iframe. Option A has pure seams (`parseProfile`, `nextPoll`, `transition`). Option B has CSP, gesture and layout, none of which a unit test reaches. No one has tested SSE inside an extension page in production either (`research-experience.md`, Negative results).

6. **The cost estimate is conditional on core work that doesn't exist yet.** "~0.5 person-night if the embed route exists" (`03-options.md`, Option B, Cost). The embed route needs the run view, which is the core's most unstable part. The pre-mortem's top risk is the extension eating the core, with a hard gate at T+5h (`06-extension-pre-mortem.md`, T1). Option B ties extension progress to the UI that gate protects. CSP work and the Firefox check are extra, which puts it above half a night. Option A's estimate is stated at one night.

7. **It gains nothing on LinkedIn policy.** LinkedIn bans extensions that "scrape, modify the appearance of, or automate" (`research-case-studies.md` §6). Option B keeps the injected content-script button, so it modifies the page just as Option A does. LinkedIn's extension-ID scanning (BrowserGate, same section) detects the install either way. In fairness, a side panel is less intrusive than an overlay. Seamless moved to one for that reason (`research-case-studies.md`, Seamless). That is a UX gain, not a policy gain.

**Strongest single point:** Option B cannot tell a user whose panel is closed that the profile is done, and its own Evolution section concedes the fix is Option A's poller.

---

## Option C

### Advocate

**Concession.** The user asked for browser plugins. Option C is not one. It delivers the three verbs they named, which are click "research this person", be told when it is done, and click through. It skips the install step. The case below is that the install step is where the risk is.

1. **Zero MV3 surface removes four of the pre-mortem's tigers.** The service worker dies after 30 s idle, Firefox has no `service_worker`, Firefox notifications have no buttons, and extension Web Push is Chrome-only (`03-options.md`, shared facts). The dead worker and the Firefox manifest split are pre-mortem T3 and T5 (`06-extension-pre-mortem.md`). Developers still stack alarms, a WebSocket ping and reconnect backoff to survive this (`research-experience.md` §1). Option C has none of these problems because it has no extension.

2. **Cross-browser push comes free on the web.** For extensions, Firefox Push is "UNCONFIRMED, treat as unavailable" (`research-mv3-docs.md` §5). For websites, Push has existed since Firefox 40 (same section). Chrome and Edge also support it for sites (`03-options.md`, Option C). An extension must poll with alarms, and Firefox alarms do not persist across restarts (`research-mv3-docs.md` §2; `research-experience.md` §2). Option C is the only option whose Firefox notification path is documented to work.

3. **No store review.** The Chrome Web Store, Edge and AMO each have their own hurdles. Single-purpose and Limited Use review apply (`research-mv3-docs.md` §9). AMO needs a gecko id, mandatory `data_collection_permissions` and a sources zip (`research-frameworks.md`, platform facts). Edge needs a separate developer account, and one developer called Microsoft Store publishing "a nightmare" (`research-experience.md` §2). The pre-mortem already concedes that store review is "a post-hackathon week" (paper tigers). Option C ships with a deploy.

4. **All code is app code with Vitest seams.** The prefill parser and a `sendPush(subscription, payload)` port are plain Vitest targets (`03-options.md`, Option C test seams). Option A also needs fake-browser, and Playwright loads extensions in Chromium only (`research-frameworks.md`, platform facts). Firefox has no automated end-to-end path in the sources read (`research-experience.md` §4). The repo rule that new code under `src/domain` and `src/recipe` ships with tests applies cleanly here (`CLAUDE.md`, definition of done).

5. **Minimal LinkedIn exposure.** LinkedIn's help page bans extensions that "scrape, modify the appearance of, or automate activity" (`research-case-studies.md` §6). A class action alleges LinkedIn scans for 6,236 extension IDs (same section, secondary source). A bookmarklet is a user-initiated click that injects no UI and has no extension ID to detect (the last clause is rhetoric). It reads the same three fields the pre-mortem allows (T2). The pre-mortem's elephant 2 already says to make "any page" the headline and LinkedIn one case of it.

6. **The push infrastructure is reused.** Chrome extension Push uses a VAPID key and any push provider (`research-mv3-docs.md` §5). Option A lists Web Push as its own "optional fast path" (`03-options.md`). The subscription table and send step built for C therefore serve a later extension (`03-options.md`, Option C evolution). Push also removes the polling load of pre-mortem T8, and no run token sits in extension storage (T4). Where the token lives instead is not specified (rhetoric).

7. **It protects the score.** The extension is "a 25% originality play, not a 35% value play" (pre-mortem, elephant 1). T1 warns that the extension eats the core. Option C costs about 0.5 person-night against about 1 for A (`03-options.md`). Honesty is worth 10 points, and a bookmarklet has nothing to overclaim (rhetoric).

**Real costs.** "Drag to bookmarks bar" is "2010" (`03-options.md`). The page must be open or a subscription granted before the push works (rhetoric). There is no LinkedIn-native button, so the demo looks less impressive (rhetoric).

**Strongest single point:** Option C delivers click, be informed and click through on all three browsers with push that is documented to work on each, while adding no store review, no MV3 worker lifecycle and no extension-specific LinkedIn exposure.

### Prosecutor

1. **It is not what was asked, and it is a rejection of the brief.** The user asked for Chrome, Edge and Firefox extensions where you click "research this person". Option C opens with "no extension at all" (03-options, Option C, Essence). The pre-mortem calls the extension "a 25% originality play" about reach (06-extension-pre-mortem, Elephant 1). Option C gives up that play and offers nothing in its place. A jury reading "we built a bookmarklet" will see a team that avoided the work. (Jury reaction is rhetoric.)

2. **The option's own text concedes the UX is dated.** The cost line says the "drag this to your bookmarks bar" step is "2010" (03-options, Option C, Cost). Chrome hides the bookmarks bar on a fresh profile, so discoverability is poor. (The hidden-bar default is rhetoric.) There is no injected button on the profile, no toolbar icon, and no right-click entry. Every comparable tool in the case studies uses an injected widget, a side panel or a popup (research-case-studies, Cross-cutting answer 1).

3. **The LinkedIn claim is asserted with no evidence.** The option says LinkedIn's CSP does not block bookmarklets in Chrome or Firefox (03-options, Option C, Cost). None of the four research files tests this. The case-study file covers extensions only. The h1 selector fragility in pre-mortem T6 also applies to the bookmarklet, and it has no `document.title` fallback mounted in the page. Mobile and LinkedIn app flows are unaddressed. (The mobile point is rhetoric.)

4. **Web Push on Workers is more backend than Option A's status route.** Option C needs a VAPID key pair as a new secret, a subscriptions table, a Web Crypto push library named only as "`@block65/webcrypto-web-push` or similar", and a send step inside the Workflow (03-options, Option C, Aggregate and Cost). Option A needs about 60 lines for a JSON status route (03-options, Option A, Cost). The research files contain no evidence of Web Push working on Workers. Section 5 of research-mv3-docs covers only extension push. The "0.5 person-night" estimate is unsupported. (The estimate challenge is rhetoric.)

5. **Permission friction and no fallback signal.** Web Push needs a permission prompt on the app origin, and the user must grant it before the first run. Safari on macOS adds its own friction. (Both rhetoric.) Pre-mortem T9 says Focus mode can hide notifications and that the toolbar badge is the always-on fallback. Option C has no badge and no toolbar queue. The only queue is an app tab that must stay open (03-options, Option C, Essence). Option A can set a badge (research-mv3-docs §4, `action.setBadgeText`).

6. **The "push infrastructure serves the extension later" claim is contradicted by the evidence.** Firefox has no service worker for extensions (research-mv3-docs §2). No evidence was found of a PushManager in Firefox extension event pages (research-mv3-docs §5, marked UNCONFIRMED). Extension Web Push is Chrome-only, with no production reports (research-experience §3; 03-options, "Not carried forward"). Polling through alarms is the cross-browser baseline (research-mv3-docs §5, Viability). A later extension therefore needs the status route and alarms anyway. The push work is mostly throwaway for Firefox and optional for Chrome. A subscription made in the app's service worker is also not an extension's subscription. (The last point is my inference.)

7. **Test seams and the demo are weaker than claimed.** The option says the push step is "tested in Vitest with a fake port" (03-options, Option C, Test seams). That proves nothing about real delivery through FCM or Mozilla's push service. Delivery latency on stage is outside our control. (Latency is rhetoric.) The end-to-end criterion is 20% of the score, and a notification that never arrives is the worst failure mode.

Strongest single point: Option C skips the requested extension, and its claim that the push work carries over to Firefox contradicts the repo's own research, so the Firefox build would need the polling Option A already provides.

---

## Cross-examination

### Option A
- **Advocate's best point** (polling is the one completion channel documented to work in all three browsers). *Rebuttal*: documented is not the same as dependable; Adblock Plus and Ariadne both report alarm unreliability under 60 s, and Firefox alarms die with the session. The honest reading: poll at 60 s, re-create the alarm on every background start, reconcile the whole queue on popup open so a missed tick costs nothing but latency.
- **Prosecutor's best point** (alarms and notifications are the two least dependable primitives, on a Firefox path nobody can test overnight). *Rebuttal*: the product promise degrades, it does not break. The badge and the popup reconcile against D1 truth on every open; a missed notification is a late notification, never a lost run. Firefox is one manual temporary-add-on check; if it fails, Chrome plus Edge is the ship line and the dossier says so up front.

### Option B
- **Advocate's best point** (the panel shows the jury-scored core next to the profile; the extension's pixels are the core's pixels). *Rebuttal*: that is also the strongest argument against building it tonight, because the run view does not exist yet and the T+5h gate protects exactly that work. A thin launcher opens the same run view in a tab with one click.
- **Prosecutor's best point** (a closed panel gets no signal; the fix is A's poller). *Rebuttal*: none available; the advocate conceded it.

### Option C
- **Advocate's best point** (zero MV3 surface, push documented on every browser for websites). *Rebuttal*: true for websites, but the user asked for an extension, and every comparable product ships an in-page entry point. Web Push on Workers is more backend than the status route, and it does not carry over to a Firefox extension later.
- **Prosecutor's best point** (not what was asked, and the reuse claim contradicts the research). *Rebuttal*: C's real contribution survives as a design rule for A: do nothing in the extension that the app cannot also do from a URL. The `/new?src=…` prefilled route is cheap and makes the extension optional for the demo.

**Verdict inputs**: A's prosecution is specific and strong (alarms, notifications, Firefox untestable, token in storage, public report URLs), so the court did its job; those five points become the risk register.
