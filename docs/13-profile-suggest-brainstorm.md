# 13 — Brainstorm: LinkedIn profile suggestions on the start form

**Mode**: Ideas for existing product (oldboys web app, Candidate Brief start form)

**Context**: Today the recruiter must paste the candidate's exact LinkedIn URL or a CV. Robert wants a našeptávač (typeahead) on the "Start a brief" card: type a name (plus company or city), see a short list of public LinkedIn profiles with headline and location, pick one, and the picked URL becomes the confirmed identity (plans/006). Public data only, no LinkedIn login, no cookies, budget enforced server-side.

---

## PM Perspective (user value, business impact)

1. **Name-to-profile picker on the start card** — one field "Who are you hiring?" accepts a name or a LinkedIn URL; a name shows up to 8 public profiles (name, headline, location, URL); picking one fills the profile URL. Removes the "open LinkedIn, copy URL" detour, which is most of the start-form friction. | Impact: H | Effort: M
2. **Company hint from the position** — when the form is opened from `/positions/<id>`, the position's company or the recruiter's organization pre-fills the search hint, so "Jan Novák" plus "Seznam" lands on the right Jan. | Impact: M | Effort: L
3. **Namesake honesty in the picker** — show the picker only as "profiles that match the name"; the brief still runs identity resolution. Never say "this is the person"; copy says "pick the one you mean". Matches the honesty judging criterion. | Impact: M | Effort: L
4. **Suggestion source labeled** — each suggestion shows "via web search" so the recruiter knows it is a search-engine snippet, not LinkedIn data. The chosen URL is then scraped once by the seed step as today. | Impact: M | Effort: L
5. **Fallback stays one click away** — "Paste the URL instead" and "Paste their CV" remain visible; the picker is never a gate. If search is down or rate-limited, the field degrades to the plain URL input. | Impact: H | Effort: L

---

## Designer Perspective (UX, legibility, delight)

6. **One field, two shapes** — the field detects a URL (contains `linkedin.com/in/`) and skips search; otherwise it offers "Search profiles" after 3+ characters. No separate mode switch. | Impact: M | Effort: M
7. **Explicit search, not search-on-keystroke** — a search costs money and takes 1 to 10 s. Trigger on Enter or a "Find profiles" button, show a quiet spinner and "Looking up public profiles", never a flicker per keystroke. | Impact: M | Effort: L
8. **Suggestion rows that read like a CV line** — bold name, headline in muted text, location pill, the handle in small type; 44 px targets; keyboard arrows and Enter; `role="listbox"` with `aria-activedescendant`. | Impact: M | Effort: M
9. **Chosen state is editable** — after picking, the row collapses into "Jan Novák · Data Engineer at Seznam · linkedin.com/in/jan-novak" with a "Change" link that reopens the list. The hidden `profileUrl` is what submits. | Impact: M | Effort: L
10. **Calm empty and failure copy** — "No public profiles found for that name. Try adding a company, or paste the URL." and "Profile search is not available right now; paste the URL." No red walls. | Impact: L | Effort: L

---

## Engineer Perspective (technical leverage, reliability)

11. **Web search `site:linkedin.com/in` behind one route** — `GET /api/profiles/suggest?q=` runs one search-engine query and parses titles of the form "Name - Headline - Company | LinkedIn" into suggestions. No linkedin.com request at all, so no scraping exposure; the existing `googleSearch` collector already parses this shape. | Impact: H | Effort: M
12. **Fast search API first, Apify as fallback** — a direct search API (Brave or Google Programmable Search) answers in well under a second; `apify/google-search-scraper` already exists in the stack but needs one actor run (several seconds). Pick one for the demo, keep the parser shared. | Impact: H | Effort: M
13. **Same guard rails as ARES lookups** — same-origin check, session cookie, per-IP hourly cap via `auth_attempts` (kind `suggest`), `Cache-Control: no-store`. Reuse `throttled` / `recordAttempt`. | Impact: H | Effort: L
14. **Pure parser in domain with tests** — `src/domain/profile-suggest.ts`: `parseSerpTitle`, `suggestionsFromHits` (dedupe by normalised handle, drop `/pub/`, `/company/`, directory pages). Test the parser against real SERP titles. | Impact: H | Effort: L
15. **Cost logged like every LLM or actor call** — each suggest query writes a line to the run evidence only when it leads to a run; otherwise count it in the hourly cap. Spend per query is cents at most; cap per IP keeps the bill bounded without a budget table. | Impact: M | Effort: L

---

## Top 5 Recommendations

| Rank | Idea | Why | Quick Win? |
|---|---|---|---|
| 1 | 11 + 12: one suggest route over a web-search `site:linkedin.com/in` query | Removes the URL hunt with zero LinkedIn scraping; parser already half exists | Yes |
| 2 | 1 + 6: one field that takes a name or a URL | No new mode, the current flow stays identical for URL pasters | Yes |
| 3 | 7 + 9: explicit search, editable chosen state | Bounded cost and latency; recruiter stays in control of identity | Yes |
| 4 | 13 + 14: ARES-style guard rails and a pure tested parser | Same patterns as plan 009, agent-friendly | Yes |
| 5 | 5 + 10: fallbacks and calm copy | Search outages must never block starting a brief | Yes |

Deferred: 2 (company hint from position) until positions carry a company field; 15's ledger line, the hourly cap is enough for the demo.

---

## Next Steps

Discovery (`docs/14-profile-suggest-discovery.md`) stress-tests the assumptions: search-engine coverage of Czech names, title format stability, latency from Workers, and whether recruiters trust a snippet-based list. Pre-mortem in `docs/15-profile-suggest-pre-mortem.md`; architecture options and the decision in `plans/010-profile-suggest/`.
