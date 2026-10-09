# 04 — Steelman court

Note: the research fan-out ran as two subagents (their reports are folded into 01 and 02); the Advocate and Prosecutor arguments below are single-author, written from that evidence. Treat the attacks as the ones a proponent would call fair; nothing here is a strawman.

## A. Brave Search API

**Advocate.** One REST call, under a second, answers the exact question "which public profiles match this name". The parser is ten lines and the same one the research step would need. The provider sits behind one function, so if Brave dies the way Google's JSON API did, the swap is one file. The free credit covers a demo month; the per-account cap bounds the bill. No linkedin.com traffic, so the hard rule stays clean and the identity story stays honest: "we found these via web search, you pick".

**Prosecutor.** A new vendor, a new secret, a new place to lose the demo if the key is missing or the credit runs out at the worst time. Brave's index is reported thinner than Google's on long-tail names (02-§6), and the free tier allows one request per second; a common name in Brno may return a Pole in Warsaw and nothing else. Title parsing is brittle: separators, localized "| LinkedIn" suffixes, truncated headlines. And the hackathon is judged on Apify usage; the first screen will not show an actor.

**Rebuttals.** Coverage: the query carries the hint (company or city) and the picker shows an honest empty state with "paste the URL"; the detour stays one click away, so a miss costs nothing. Brittleness: the parser keeps every hit under `/in/` even when the title does not split, showing the handle as the name. Apify judging: the run that follows is all Apify; the form field is UX, not research.

## B. Apify Google SERP actor

**Advocate.** Zero new vendors, zero new secrets, the adapter and parser already exist, and the judges see Apify from the first keystroke. Google's index beats Brave's for Czech names. Cost per lookup is the lowest of the paid options.

**Prosecutor.** A run of a container for a form field: five to twenty seconds, plus the queue. Recruiters will type, wait, and paste the URL anyway. Apify's $0.50 minimum cap per run means each lookup reserves fifty cents of budget; real spend is small, but the per-run minimum makes a hard cap by lookups the only sane control. The SERP step is already the slow one in the research run.

**Rebuttals.** Latency could be hidden behind a button and copy, and the research run tolerates it; but the ask is a našeptávač, and a twenty-second suggestion is not one. The judging argument is real but small: the Apify footprint is the whole run.

## C. Apify LinkedIn people search

**Advocate.** Structured fields, parsed location, company filter, no title parsing, no namesake ambiguity from directory pages. It is the product the ask describes.

**Prosecutor.** It reads LinkedIn search results; LinkedIn shut Proxycurl down for less visible behaviour, and the brief says public data only, no fake accounts. Whatever the vendor does to get those pages is not auditable from here. Twenty times the cost of A for a field that is used once per brief.

**Rebuttals.** The vendor states "no cookies or account required", and the repo already scrapes one public profile per run with the sibling actor. True, but scraping one public profile the recruiter chose is a narrower act than running LinkedIn's search; the first keeps the brief's honesty line, the second blurs it.

## D. Defer

**Advocate.** Nothing to break, nothing to pay, and LinkedIn's own search handles namesakes better than any snippet. The extension already captures the URL from an open tab.

**Prosecutor.** It is the status quo with a link; the request was explicitly a suggester on the start card. Every recruiter still leaves the product to find a URL.

## Cross-examination summary
- A's best point (sub-second, no LinkedIn traffic) survives B's and C's attacks; B's strongest attack on A (coverage of Czech names) is mitigated by the hint and the fallback, not eliminated.
- C's best point (structured data) does not outweigh the legal exposure under the brief's hard rules.
- B remains the named evolution path if Brave's coverage proves poor on the demo subjects: same handler, different fetcher.
