# Hackathon Case 01 · Social Media Deep Research

Topic partner: Apify. Mentors: Fabian Maume, Lukáš Průša (Apify). Jury: Fabian Maume, Eva Pelikánová (Apify).

## The real problem
Recruiters, salespeople, researchers, and investors burn hours piecing a person or company together from scattered profiles and registries, then act without sources. Search is solved; the hard part is knowing which hits are the same entity, what matters for this goal, and what is proven.

## Definition of done
Input: a person or organization, one anchor (city, website or company ID such as the Czech IČO) and a goal.
Output: a report where every claim links to a source, fact is split from inference, and gaps are stated. Same subject, different goal, different report.

## In bounds
- Identity resolution: namesakes, handles, look-alike companies
- Goal-conditioned relevance: a recruiter needs other facts than an investor
- Cross-checking sources and flagging contradictions
- Citations with a confidence level per claim
- Sources in any language and country, including public registries

## Out of bounds
- "Search and summarise" with no goal logic
- Writing scrapers an Apify actor already covers
- Personality, credit or "trustworthiness" scores of a person
- Private data: closed groups, DMs, leaks
- Outreach actually sent to the subject (drafted message shown as feature is fine)

## Hard rules
- Public data only (public LinkedIn/Instagram/X profiles, Google/Bing results OK). No fake accounts, no CAPTCHA bypass, no breach/leak DBs.
- Any person/org researchable from public data, no consent needed. Demo yourself, volunteer, company, or public figure.
- No inferring GDPR Art. 9 data: health, politics, religion, ethnicity, sexuality.
- Outreach drafted and shown, never sent. Delete raw scraped data after judging.

## Real vs faked
At least one demo subject researched live. Cached run OK in video if labeled. Mock only for unreachable source, labeled MOCK.

## What wins
Real subject in, sourced report / enriched profile out. Switching goal changes what the report says, not just headings. Namesakes and look-alikes handled. User understands how report is built.

## Decided in advance
- LinkedIn, Instagram, X, BlueSky, TikTok: public profiles fair game via Apify actors.
- Wrapping existing deep-research API: OK as one component; jury scores what's added on top.
- Person or org: either. Run time: your call, result must be worth the wait.

## Side challenge
Best ElevenLabs Use — give agent a voice. Separate small prize (Vláďa Beran).

## Ground rules
Teams ≤3. Fresh build from kick-off. Code freeze at sunrise (snapshot of latest commit). Deliverables: repo + ≤90s demo video. Honesty wins. Teams keep IP; open-sourcing encouraged.

## Judging (each 0–5, total = Σ score/5 × weight)
- 35% Value and track relevance
- 25% Originality
- 20% Working end-to-end result
- 10% Technical execution
- 10% Validation and honest limitations
