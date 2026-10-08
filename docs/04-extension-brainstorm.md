# Brainstorm: oldboys browser extension (Chrome, Edge, Firefox)
**Mode**: Ideas for existing product (oldboys web app + Workflow runner already live on oldboys.asajj.cz)
**Date**: 2026-10-08
**Context**: Recruiters and salespeople live in LinkedIn and in search results, not in our app. The extension moves the *input* to where the subject is found (mark a person on LinkedIn or any page), keeps the *research* on our Worker (Workflow, ledger, verify), and brings the user back to the app only when the sourced report is ready or when the run needs a lineup answer. The report itself stays in the app.

**Framing insight**: the extension wins nothing by itself. It wins by (1) removing the copy-paste of subject + anchor, (2) turning a 1–3 minute research run into a background job with a notification, (3) making "I marked 8 candidates, 6 are done, 2 need a namesake pick" a workflow. Every idea below must land on one of those three, or it is scope creep.

---

## PM Perspective (user value, business impact)

1. **One button on the profile: "Research for <goal>"** — injected next to the LinkedIn name; goal remembered from last use. Subject = page `<h1>`, anchor = visible location or current company, source URL = the profile URL. One click, nothing to type. | Impact: H | Effort: L
2. **Context-menu "Research this person" on any page** — select a name anywhere (conference page, news article, company team page), right-click, pick goal. Anchor = the page's domain. Works on sites we never saw. | Impact: H | Effort: L
3. **Queue with states: queued · running · needs-answer · done · failed** — the popup is a list of marked people. "Needs-answer" is the namesake lineup pause; it is the single most valuable notification because the run cannot continue without the user. | Impact: H | Effort: M
4. **Notification = "profile complete" + headline number of FACT claims and gaps** — "Jan Novák: 11 facts, 3 inferences, 2 gaps. Open report." Click opens `/runs/:id`. Honesty criteria surface in the notification text. | Impact: M | Effort: L
5. **Mark now, research later (batch)** — mark 10 profiles, hit "Run all" with one goal. Budget per run is enforced server-side, so the extension only sequences. Recruiter sourcing session fits this. | Impact: M | Effort: M
6. **Per-user API key instead of shared RUN_TOKEN** — needed the moment a second person installs the extension. Hackathon: paste token in options; after: key per user, rate-limited. | Impact: M (viability) | Effort: M

## Designer Perspective (UX, legibility, delight)

7. **Badge count on the toolbar icon** — number of runs needing attention (done but unopened + needs-answer). Zero UI to learn. | Impact: M | Effort: L
8. **"Already researched" chip on the profile** — revisit a profile, the button becomes "Report (2 days ago, CACHED) · Re-run". Replay from ledger, labeled CACHED, exactly as the app does. | Impact: M | Effort: L
9. **Inline lineup in the popup** — when a run pauses on namesakes, the popup shows the 2–5 candidates with anchor evidence; the pick posts to `/api/runs/:id/answer` without opening the app. | Impact: H | Effort: M
10. **Goal picker as the only decision** — hiring / sales / due diligence. No free-text goal, no settings on the button. The goal changes the recipe, so it has to be visible and deliberate. | Impact: M | Effort: L
11. **Side panel with the live ledger** (Chrome/Edge `sidePanel`, Firefox `sidebar_action`) — watch claims stream in beside the LinkedIn page. Flashy; duplicates the app. | Impact: L | Effort: H
12. **Privacy card in the popup** — "Public data only · no DOM scraping beyond name and location · raw data purged after judging". Hard rules as visible copy; also what store reviewers read first. | Impact: M | Effort: L

## Engineer Perspective (technical leverage, reliability)

13. **One codebase, three stores, via WXT** — WXT (Vite) emits MV3 for Chrome and Firefox with the right `background` shape per browser (`service_worker` vs `scripts`); Edge installs the Chrome zip unchanged. No hand-maintained manifests. | Impact: H | Effort: L
14. **Poll, do not stream, from the extension** — MV3 service workers are killed after ~30 s idle, so an SSE tail dies. Use `alarms` (≥30 s in Chrome 120+, 1 min Firefox) hitting a new cheap `GET /api/runs/:id` JSON status route. The SSE route stays for the app. | Impact: H | Effort: L
15. **Status route returns a projection, not the ledger** — `{status, claims: {fact, inference}, gaps, needsAnswer: candidates[] | null, updatedAt}`. One D1 query, cacheable, under 1 KB. Also what the app's list view needs. | Impact: H | Effort: L
16. **Extension never scrapes LinkedIn** — content script reads only `location.href`, the `<h1>` text and the location line the user is looking at. Research still goes through Apify actors against public URLs. Keeps the hard rule and the store reviews clean. | Impact: H | Effort: L
17. **Idempotent start: `subjectUrl` as dedupe key** — `POST /api/runs` accepts optional `sourceUrl`; same URL + same goal within 24 h returns the existing run id instead of spending budget again. | Impact: M | Effort: L
18. **State in `storage.local`, truth in D1** — the extension stores `{runId, goal, subject, sourceUrl, lastStatus}`; on popup open it reconciles against the status route. Reinstall = lose the list, not the runs. | Impact: M | Effort: L
19. **CORS allowlist for extension origins** — `chrome-extension://<id>` and `moz-extension://<uuid>` differ per install; use a bearer token and `Access-Control-Allow-Origin: *` only on the three run routes, never on the app pages. | Impact: M | Effort: L

---

## Top 5 Recommendations

| Rank | Idea | Why | Quick win? |
|---|---|---|---|
| 1 | #1 + #2 Profile button and context menu | The whole value: input where the subject is. Two entry points, same code path | Yes |
| 2 | #3 + #4 + #7 Queue, notification, badge | The "it informs you when complete" promise. Nothing else makes the extension more than a bookmarklet | Yes |
| 3 | #13 + #14 + #15 WXT, polling, status route | Only way three browsers ship from one night's work and keep working after the service worker dies | Yes |
| 4 | #9 Inline lineup | Turns the namesake pause from a dead end into a 2-second decision; also the originality story on stage | No, second pass |
| 5 | #16 + #12 No DOM scraping, privacy card | Keeps us inside the brief's hard rules and inside LinkedIn's and the stores' policies | Yes |

Dropped on purpose: #11 side panel (duplicates the app), #5 batch (after per-run flow works), #6 per-user keys (viability, not value; token paste is enough for the demo).

## Next steps
Assumptions and experiments: `docs/05-extension-discovery.md`. Risks: `docs/06-extension-pre-mortem.md`. Architecture: `plans/004-browser-extension/`.
