# 02 — Case studies and experience reports

Research date 2026-10-08. Raw reports with every URL: `evidence/research-case-studies.md`, `evidence/research-experience.md`. FACT and INFERENCE are separated in the raw files; this page keeps the decision-relevant findings.

## Named adopters: LinkedIn-adjacent extensions
| Tool | Entry point | What it reads from the page | Completion | Browsers |
|---|---|---|---|---|
| Lusha (2016, v1 was Chrome + LinkedIn only, 5 free credits) | injected widget on profile | name, title, company (inferred) | inline from pre-built DB | Chrome, Edge |
| Kaspr | widget auto-opens on LinkedIn after "connect" | contact data including fields visible only to 1st/2nd-degree connections | inline | Chrome |
| Seamless.AI | overlay fly-out, moved to Chrome Side Panel on 2024-11-08 because the fly-out covered the page | profile name | inline in panel | Chrome |
| Apollo | injected | not published | inline | Chrome |
| Hunter.io | toolbar popup, works on the visited page's domain, open source, one Grunt tree builds Chrome, Edge, Firefox | page domain only | inline | Chrome, Edge, Firefox |
| Crystal Knows | "View Personality" button on the profile | profile URL | inline | Chromium only, Firefox explicitly unsupported |
| Clay "Clip to Clay" | button saves the profile URL into a table | URL (partly inferred) | server-side later, results in the web app | Chrome |
| PhantomBuster | hands the LinkedIn session cookie to cloud runners | cookies | cloud | Chrome, Firefox |

Findings:
- Nobody in the sample runs a multi-minute job from the extension; all return inline from a pre-built database. **A run id plus badge or notification plus a link to the report is a new pattern, not a copied one.**
- Hunter is the proof that one tree ships three browsers when the extension is small and avoids `sidePanel`. Crystal and Seamless show that Firefox is the first thing dropped once the UI gets rich.
- Seamless's move from overlay to side panel says overlays that cover the page are the top UX complaint; a small button is safer than a panel.

## Legal and policy
- LinkedIn Help bans third-party "browser plug-ins, or browser extensions that scrape, modify the appearance of, or automate activity"; members risk restriction. hiQ v. LinkedIn: Nov 2022 ruling made the user-agreement scraping ban enforceable in contract; Dec 2022 stipulated judgment (USD 500k, injunction, destroy scraped data). Proxycurl (resolved 2025-07-28) and ProAPIs (Oct 2025, agreement 2026-02) cases centred on fake accounts and server-side fetching of LinkedIn.
- CNIL fined Kaspr EUR 240k on 2024-12-05: it collected data visible only to logged-in connections, kept it 5 years, informed subjects late. **"Public" means visible to an anonymous visitor.**
- BrowserGate (2026): LinkedIn acknowledged scanning for about 6,000 extension IDs to detect scrapers; class action filed 2026-04-07 (secondary sources). An installed extension that touches LinkedIn is detectable.
- No primary-source Chrome Web Store or AMO takedown of a named LinkedIn tool was found for 2023 to 2026; the store risk is Limited Use and single purpose review, not LinkedIn.
- Browserflow cease-and-desist (2023-01-30): LinkedIn objected to "LinkedIn scraper" marketing and logos.

Implications adopted by every option: read only URL, `<h1>` name and the location line the user is looking at; never fetch linkedin.com server-side; no automation of clicks or scrolling; minimal host permissions; no LinkedIn branding; per-claim source list and a retention statement.

## Production experience with MV3 (2023 to 2026)
PRAISE
- Since Chrome 116 the worker lifetime extends with activity; the WebSocket keepalive pattern is officially blessed.
- Adblock Plus moved all state to `storage.session` and replaced timers with alarms, avoiding intervals under 60 s. That is the pattern to copy.
- InfoDiet (HN 2026-07-21): `storage.sync` persistence plus a 1-minute alarm resync is enough for tab-state tools.
- One developer (HN 2025-01-06): Chrome MV3 "surprisingly straightforward", Edge port "took minutes", Firefox "clunkier".
PAIN
- Ariadne (HN 2026-03-02): still stacks a 30 s alarm, WebSocket ping and exponential backoff to survive worker sleep.
- W3C WECG issues #1014 and #1016 (May 2026): long fetches and long work are killed with no error signal; keepalive alarms and offscreen documents only reduce the failures.
- Firefox alarms do not persist across restarts and misalign after sleep (Mozilla Discourse 2022-12-16).
- No production report of SSE, `EventSource` or Web Push running inside an extension was found. Negative result: treat all three as untested.
- Offscreen documents used purely as keepalive: no policy statement either way, no incident found. Avoid.

## Agentic era
- Documented agent hallucinations for extensions (opinion blog, 2026-07, grade C): persistent background pages, `localStorage` in the worker, `setInterval` for periodic work, remote scripts, bundled API keys, MV2 manifest keys.
- Claude-Code-built extensions appear on HN in 2026 (Ariadne, Claude Tuner, Pablo); the lifecycle lessons were learned by the builders after the fact. Negative result: no quantified study, no first-hand report on whether WXT or Plasmo conventions help or confuse agents.
- What lets an agent iterate without a human: WXT's Vitest plugin with the fake browser for logic; Playwright with a persistent Chromium context and `--load-extension` for wiring; a test that kills the worker to prove state restore. Firefox has no equivalent in the sources read.

## Token storage
- Consensus: backend proxy first, `chrome.storage` second (unencrypted on disk). A pasted token on an options page is the dominant indie pattern. No postmortem of a leaked pasted token or a rate-limit incident was found.
