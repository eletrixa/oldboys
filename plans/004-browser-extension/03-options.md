# 03 — Options: how the browser extension is shaped

Three genuinely different shapes. All three keep the research itself on the existing Worker (`ResearchRunWorkflow`, D1 ledger, R2 sources); they differ in *where the user interface lives*, *how completion reaches the user*, and *how much browser-platform surface we take on*.

Shared facts that constrain every option (see `01-deep-dive.md`): Chrome MV3 service workers stop after 30 s idle and cut fetches over 30 s; Firefox has no `service_worker` and uses a non-persistent event page; `alarms` with a 30 s floor is the only cross-browser timer; Firefox notifications have no buttons; Web Push in extensions is Chrome-only; Playwright can load extensions only in Chromium.

---

## Option A — "Launcher": thin WXT extension, polling, OS notification

**Essence**: the extension is a remote control for the app. It starts a run, remembers its id, polls a small JSON status route from an alarm, fires an OS notification on `done` or `paused`, and opens the app on click. No research logic, no report rendering in the extension.

```mermaid
flowchart LR
  subgraph ext[Extension · WXT MV3 · one codebase, chrome/edge/firefox builds]
    CS[content script<br/>linkedin.com/in/*<br/>shadow-root button<br/>reads URL, h1, location]
    CM[context menu<br/>any page, selection]
    BG[background<br/>SW on Chrome/Edge · event page on Firefox<br/>alarms 0.5–1 min · notifications · badge]
    PU[popup<br/>queue: queued/running/needs-answer/done<br/>goal picker · options: token]
    ST[(storage.local<br/>runs[] · token)]
    CS -- message start --> BG
    CM -- message start --> BG
    PU -- read/write --> ST
    BG -- read/write --> ST
  end
  BG -- "POST /api/runs {subject, anchor, goal, sourceUrl} Bearer" --> API
  BG -- "GET /api/runs/:id (new, JSON projection) every alarm tick" --> API
  BG -- "notifications.onClicked → tabs.create(app/runs/:id)" --> APP
  subgraph cf[Cloudflare · existing]
    API[Next.js route handlers]
    APP[Next.js report page /runs/:id]
    WF[Workflow ResearchRun]
    D1[(D1)]
    API --> WF --> D1
    API --> D1
  end
```

**DDD boundaries**: new bounded context *Marking* (a `Mark` = `{sourceUrl, subject, anchor, goal}` captured in the browser; invariant: a mark produces at most one run per goal per 24 h, enforced server-side by `sourceUrl` dedupe). *Investigation* stays where it is. The extension holds a *projection* of Investigation status, never the truth.

**Test seams**: `extension/src/lib/*` pure: `parseProfile(document) → Mark`, `nextPoll(runs, now) → fetches`, `transition(prev, next) → notification | null`; Vitest with WXT's `fake-browser` for storage/alarms/notifications; one Playwright Chromium smoke that loads the unpacked build and asserts the button mounts on a saved LinkedIn HTML fixture. Worker side: status route tested like the other routes.

**Evolution**: inline lineup in the popup (POST answer) → batch "run all" → per-user keys → optional Web Push on Chrome as a faster path with alarms as fallback.

**Cost**: ~1 person-night for v1; Worker deltas ≈ 60 lines (status route, `sourceUrl` column + dedupe, per-token hourly cap).

---

## Option B — "Panel": the app itself inside the extension

**Essence**: the extension is a window onto the app. The popup or side panel hosts the Next.js UI (iframe of `oldboys.asajj.cz/embed/...` or a bundled React copy of the run view), which keeps the SSE stream open in page context and shows claims live beside the LinkedIn page. Notifications are fired by the panel while it is open. Background is near-empty (context menu + open panel).

```mermaid
flowchart LR
  subgraph ext[Extension · WXT MV3]
    CS[content script<br/>button → open panel with prefill]
    SP[side panel (Chrome/Edge sidePanel)<br/>sidebar_action (Firefox)<br/>iframe → app /embed/runs/:id]
    BG[background<br/>context menu · open panel]
    CS --> BG --> SP
  end
  SP -- "SSE /api/runs/:id/events (page context, survives)" --> API
  SP -- "POST /api/runs · /answer" --> API
  subgraph cf[Cloudflare · existing]
    API[route handlers]
    EMB[/embed/* pages · CSP frame-ancestors chrome-extension:, moz-extension:]
    WF[Workflow] --> D1[(D1)]
    API --> WF
  end
```

**DDD boundaries**: no new context; the extension is a thin host for the app's *Run view*. The lineup answer stays in the app's own component. Marking happens in the panel form, prefilled by the content script.

**Test seams**: content-script prefill is pure; the panel is the app's existing React code, tested in the app. Extension-specific test surface is tiny; the risk is integration (CSP, iframe, sidePanel gestures), which is only testable by a human or Playwright Chromium.

**Evolution**: add a background poller later for "notify when closed" (which is Option A); add Firefox once `sidebar_action` layout is verified.

**Cost**: ~0.5 person-night if the embed route exists; plus CSP work and the Firefox sidebar check. Report and live view come for free from the app.

---

## Option C — "Do less": bookmarklet plus the app's own Web Push

**Essence**: no extension at all. A bookmarklet opens `oldboys.asajj.cz/new?src=<url>&subject=<h1>&anchor=<loc>`; the app tab is the queue; the app registers a *web* service worker and uses standard Web Push (Chrome, Edge, Firefox all support it for websites) to notify when a run finishes. Click opens the report. Nothing to install, nothing to review, no MV3.

```mermaid
flowchart LR
  BM[bookmarklet on any page<br/>javascript: reads URL, h1, location<br/>opens app/new?…]
  BM --> NEW[app /new (prefilled form)]
  NEW -- POST /api/runs --> API
  APP[app tab · queue · report] -- "SSE while open" --> API
  SW[app web service worker] -- "Push subscription (VAPID)" --> PUSH[(Cloudflare: push subscriptions table in D1)]
  WF[Workflow ResearchRun] -- "on done/paused: web-push send" --> SW
  SW -- showNotification → click → /runs/:id --> APP
  subgraph cf[Cloudflare]
    API --> WF
    PUSH
  end
```

**DDD boundaries**: *Subscription* becomes a small new aggregate in the app (`{endpoint, keys, createdAt}`), owned by the Worker. Marking is just the prefilled form.

**Test seams**: everything is app code: the `/new` prefill parser, the push-send step in the Workflow (port = `sendPush(subscription, payload)`), tested in Vitest with a fake port. No browser-extension test surface.

**Evolution**: when a real injected button is required, add Option A on top; the push infrastructure then serves the extension too (Chrome) or stays as the app's channel.

**Cost**: ~0.5 person-night: push subscription route, VAPID keys (one more secret), `web-push` on Workers (needs the Web Crypto path; `@block65/webcrypto-web-push` or similar), bookmarklet install page. Risk: LinkedIn's CSP does not block bookmarklets in Chrome or Firefox, but the UX of "drag this to your bookmarks bar" is 2010.

---

## Not carried forward
- **Option B + background poller** (both panel and launcher): this is A with B's cost added; evaluated as A's evolution step, not as a candidate.
- **Web Push inside the extension** (Chrome 121+): Chrome-only, no production reports found (`02`); kept as A's optional fast path.
- **Phantombuster-style session-cookie handoff**: the riskiest design in the case studies (`02`); violates the brief's spirit (logged-in data) and LinkedIn's terms. Rejected.
