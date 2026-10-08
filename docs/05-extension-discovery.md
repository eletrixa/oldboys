# Discovery Plan: oldboys browser extension

**Date**: 2026-10-08
**Product Stage**: existing product (web app + Workflow runner), new surface
**Discovery Question**: does moving the *input* of a research run to a browser extension (mark on LinkedIn or any page, notify on completion, click through) create enough value to be worth one night of a three-person team, and can it ship on Chrome, Edge and Firefox from one codebase?

## Ideas explored
See `docs/04-extension-brainstorm.md`. Carried forward:

| Idea | Rationale |
|---|---|
| A. Profile button + context menu start a run | The core promise |
| B. Queue, badge, completion notification, click-through | "Informs you when the profile is complete" |
| C. One codebase via WXT, polling status route | Three browsers, one night |
| D. Inline lineup answer in the popup | The namesake pause is where the user is actually needed |

## Critical assumptions

| # | Assumption | Category | Impact | Uncertainty | Priority |
|---|---|---|---|---|---|
| A1 | Users (recruiters, sales) find the subject on LinkedIn or a web page *before* they want research; the extension is in their path | Value | H | L | proceed |
| A2 | A 1–3 minute run is long enough that "background + notify" beats "watch the page" | Value | H | M | test |
| A3 | Name + visible location from the LinkedIn header is a good enough anchor to resolve identity in most cases | Value / Feasibility | H | M | test |
| A4 | Reading `<h1>` and the location line of the page the user is viewing, without scraping anything else, is acceptable to LinkedIn's terms and to store reviewers | Viability | H | M | test (desk research) |
| A5 | Firefox's MV3 (`background.scripts`, no `service_worker`) and Chrome's MV3 (`service_worker`, `alarms` ≥30 s) can be served by one WXT build with no browser-specific code beyond the manifest | Feasibility | H | L | spike |
| A6 | `chrome.notifications` click reliably opens a tab on all three browsers (Firefox has no buttons, but click works) | Feasibility | M | L | spike |
| A7 | A shared `RUN_TOKEN` pasted into the options page is acceptable for the demo; per-user keys are post-hackathon | Viability | M | L | proceed, note |
| A8 | Users will pick a goal every time (no silent default) and still find it one-click | Usability | M | M | test |
| A9 | Chrome Web Store / AMO review is not needed for the demo (unpacked / temporary add-on / Edge "Load unpacked") | Viability | H | L | proceed |
| A10 | Polling every 30–60 s is fast enough for "notify when complete" | Usability | M | L | proceed |
| A11 | The team can build it without starving the core product (T+5h e2e gate) | Viability | H | H | gate |

Leap-of-faith: A2, A3, A4, A11.

## Validation experiments

| # | Tests | Method | Success criteria | Effort | When |
|---|---|---|---|---|---|
| E1 | A5, A6 | Spike: WXT project, one content script that logs `<h1>`, one alarm that fires a fetch, one notification that opens a tab. Load unpacked in Chrome and `about:debugging` in Firefox | Both browsers: button injected, alarm fires after SW/event page unload, notification click opens a tab | 1 h | first |
| E2 | A3 | Run 5 real LinkedIn profiles (self, teammates, two public figures) through `POST /api/runs` with subject = header name, anchor = header location | ≥4/5 resolve without lineup; the 5th pauses with the right candidate in the lineup | 30 min, needs core runner | after core e2e |
| E3 | A4 | Desk research: LinkedIn User Agreement §8.2, Chrome Web Store "limited use" and "single purpose", AMO policies; compare to Lusha/Apollo extension listings | Written one-paragraph position in `docs/06-extension-pre-mortem.md` (T2) that a reviewer or jury accepts | 20 min | tonight |
| E4 | A2, A8 | Wizard of Oz on 3 teammates: mark 3 profiles each from the extension, do something else, react to notifications. Count: did they open the report from the notification or from the app? | ≥2/3 open from the notification; nobody asks "which goal did I pick?" | 20 min | after E1 |
| E5 | A11 | Time-box: extension only starts after core e2e run at T+5h; if core slips, extension is a Chrome-only demo on a cached run | Core e2e green before first extension commit | gate | T+5h |

## Timeline (hackathon night)
- Before T+5h: E3 only (desk research, no code).
- T+5h to T+6h: E1 spike inside the real repo (`extension/` folder, WXT).
- T+6h to T+8h: build the five minimal features; E2 on real profiles.
- T+8h: E4 with teammates, fix copy; Firefox temporary add-on check; Edge load unpacked.
- Sunrise: video shows mark on LinkedIn → notification → report, labeled LIVE or CACHED.

## Decision framework
- E1 fails on Firefox → ship Chrome + Edge; Firefox listed as "builds, not demoed".
- E2 resolves <4/5 → the button additionally asks for an anchor (prefilled, editable); do not auto-start.
- E3 finds a hard "no extensions" line → keep context menu on all sites, replace the injected LinkedIn button by the context menu on LinkedIn too (no DOM injection, only URL and selection).
- E4: nobody uses the notification → drop badge/notification, keep queue in popup, save an hour.
- E5: core not e2e by T+5h → extension demo = Chrome, cached run, 15 seconds of video, nothing more.

## Next steps
Pre-mortem: `docs/06-extension-pre-mortem.md`. Architecture decision: `plans/004-browser-extension/00-SYNTHESIS.md`.
