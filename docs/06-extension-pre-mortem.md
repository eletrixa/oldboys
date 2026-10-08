# Pre-Mortem: oldboys browser extension (Chrome, Edge, Firefox)

**Date**: 2026-10-08
**Status**: Draft
**Scenario**: It is sunrise. The extension is in the video. Either it broke on stage, took the night from the core product, or the jury asked one question we could not answer. Why?

### Risk summary
- **Tigers**: 9 (5 launch-blocking, 2 fast-follow, 2 track)
- **Paper Tigers**: 4
- **Elephants**: 4

---

### Launch-blocking Tigers

| # | Risk | Likelihood | Impact | Mitigation | Owner | Deadline |
|---|---|---|---|---|---|---|
| T1 | **Extension eats the core.** Three people, one night; the extension is fun, the verify step is not. Sunrise: a lovely button, no sourced report. | H | H | Hard gate: no extension commit before the first end-to-end run (T+5h). Extension work is one person, time-boxed 3 h, with a fallback of "Chrome only, cached run". | Lead | T+5h |
| T2 | **LinkedIn terms or store policy question from the jury.** "Is this allowed?" LinkedIn's User Agreement bans scraping and "browser extensions that scrape". hiQ v. LinkedIn (2022 settlement) left LinkedIn free to ban logged-in scraping. | M | H | The extension reads only the profile URL, the `<h1>` name and the location line *the user is looking at*; nothing else leaves the page. All research runs server-side through Apify actors on public URLs. One paragraph on this in the README and in the popup's privacy card. Context menu on any site needs no DOM at all. | Extension | T+6h |
| T3 | **Service worker dies, run finishes, nobody is told.** Chrome kills MV3 workers after 30 s idle; an SSE `EventSource` in the worker is gone before the first claim. | H | H | No SSE from the extension. `alarms.create` with `periodInMinutes: 0.5` (Chrome 120+) / 1 (Firefox), each tick fetches `GET /api/runs/:id` for every non-terminal run and fires `notifications.create` on transition. State in `storage.local`. | Extension | T+6h |
| T4 | **RUN_TOKEN in the extension leaks.** The shared bearer in `storage.local` is readable by anyone with the extension folder; one leak = unbounded spend on our Apify and Anthropic keys. | M | H | For the demo: token pasted by the user in the options page, never bundled; budget is enforced per run server-side ($0.50, 12 calls) and the Worker caps runs per token per hour (new: 20/h). After the hackathon: per-user keys. Rotate the token after the video. | API | T+6h |
| T5 | **Firefox build diverges at 4 am.** Chrome needs `background.service_worker`; Firefox MV3 needs `background.scripts` and does not support `service_worker` (bug 1573659). Hand-written manifest breaks one of them. | M | M | WXT generates both; `wxt build -b firefox` and `wxt build -b chrome`. Edge installs the Chrome zip. Test Firefox once with `about:debugging` at T+7h, then leave it. | Extension | T+7h |

### Fast-follow Tigers

| # | Risk | Likelihood | Impact | Planned response | Owner |
|---|---|---|---|---|---|
| T6 | LinkedIn's DOM changes; the `<h1>` selector returns nothing; button never appears. | M | M | Fallback: button mounts anyway and prefills subject from `document.title` ("Jan Novák - CTO - Firma | LinkedIn"). Context menu on selection remains. | Extension |
| T7 | Notification click opens the app, the app asks for a token again (no shared session). | M | M | Click opens `/runs/:id?token=…`? No: report pages are read-only and public by unguessable UUID for the hackathon. Say so in the README. Post-hackathon: session cookie + per-user key. | API |

### Track Tigers
- T8 Polling cost: 10 users × 2 runs × 2 polls/min against D1. Trigger: D1 reads over 50k/day → switch the status route to a KV-cached projection.
- T9 Notification permission denied or notifications hidden (Focus mode on macOS, Windows quiet hours). Trigger: E4 shows a tester missing it → the badge count is the fallback and is always on.

### Paper Tigers
- **"We need to publish to three stores tonight."** No. Unpacked in Chrome and Edge, temporary add-on in Firefox, zipped builds in the release. Store review is a post-hackathon week, not a night.
- **"Edge needs its own build."** It does not; Edge installs the Chrome MV3 zip. Only the store listing differs.
- **"Users will mark hundreds of profiles and bankrupt us."** Budget per run and runs per token per hour are enforced in the Worker, not in the extension; the extension cannot spend more than the API allows.
- **"CORS from `chrome-extension://` origins will block us."** Extension origins are per install, so an allowlist is impossible, but the three run routes already take a bearer token; `Access-Control-Allow-Origin: *` on those routes only is correct and safe (no cookies involved).

### Elephants in the room
1. **The extension is a 25% originality play, not a 35% value play.** The jury scores identity resolution, goal logic and provenance. The extension adds none of these; it adds reach. If the core report is weak, the extension makes that more visible, not less. Conversation: "do we show the extension in the first 30 s of the video, or the last 15?" Suggested: last 15.
2. **We are quietly building a LinkedIn tool.** The brief says LinkedIn public profiles are fair game *via Apify actors*. The extension's first entry point is the LinkedIn profile page the user is logged into. If the LinkedIn actor is dead (core pre-mortem T1), the extension's main button starts runs that LinkedIn cannot feed. Conversation: make the context menu on *any* page the headline, LinkedIn one case of it.
3. **Nobody has said who the user is.** Recruiter sourcing on LinkedIn and sales prospecting on a company team page are different flows (batch vs single, hiring vs sales goal). Suggested: recruiter, hiring goal, single profile; everything else after.
4. **Report pages become public by URL.** The notification click has no session; the report URL is the key. It contains sourced claims about a real person. Conversation: is a UUID-only report page acceptable for the hackathon? Suggested: yes, with "purged after judging" visible, and a `noindex` header.

### Go/No-Go checklist
- [ ] Core end-to-end run green before first extension commit (T1)
- [ ] Privacy paragraph written: URL, name, location only (T2)
- [ ] Alarms-based polling verified after service worker unload (T3)
- [ ] Token pasted, not bundled; runs-per-token cap live (T4)
- [ ] Firefox temporary add-on loaded once (T5)
- [ ] Rollback: the video has a cut that works without the extension
