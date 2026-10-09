# Josef Buryan: what a full public scrape returns, and which brief sections it supports

Date 2026-10-09. Test subject: Josef Buryan, CMO at Groupon, Prague (LinkedIn `/in/josef-buryan`). Offline scrape with `apify-client`, one actor at a time, outside the app. Raw datasets stay in the scratchpad and are not committed. No LLM calls. Hard rules respected: public data only, no Art. 9 inference, no scores, private accounts not used.

## 1. Actor results

Cost is the real billed amount from each run record (`usageTotalUsd` after the run settled). The value the client returns right when `.call()` resolves is often 0 for pay-per-event actors, so re-read the run record before writing it to the ledger.

| Actor | Input summary | Items | Cost USD | Useful? |
|---|---|---|---|---|
| harvestapi/linkedin-profile-scraper | profile URL, mode "Profile details no email" | 1 | 0.0040 | Yes. Headline, about, 7 roles, 4 schools, 50 skills, 18 certifications, 2 publications, 3 projects, 2 volunteering, 6 languages |
| harvestapi/linkedin-profile-posts | profile URL, last 30 posts | 30 | 0.0601 | Yes. Dated posts, text, likes and comments, post URL. Includes 2 reposts of other people |
| harvestapi/linkedin-company | groupon company URL | 1 | 0.0041 | Yes. Employees 10298, followers 359180, public company, founded 2008, tagline, locations, specialities |
| apify/google-search-scraper | 8 queries, 1 page each, cz/cs | 8 SERP pages, about 70 hits | 0.0201 | Yes, the best discovery source. Found every other source below |
| apidojo/tweet-scraper (search) | `"Josef Buryan"` | 20 | 0.0080 | Partly. 17 of 20 are his own tweets, 3 are a third party discussing Groupon people |
| apidojo/tweet-scraper (profile) | handle josefburyan, latest 20 | 20 | 0.0080 | Partly. Bio, 2402 followers, join year 2009. Tweets span Jan to Sep, mixed Czech and English, mostly replies |
| streamers/youtube-scraper (search) | `Josef Buryan`, 10 videos | 10 | 0.0300 | Yes for the podcast video (Shopsys, 41 min). Rest is his own old travel videos. Some detail pages returned 429 and retried |
| streamers/youtube-scraper (channel) | channel URL, 1 video | 1 | 0.0030 | Low. Gives channel facts (157 subscribers, 20 videos, joined 2012), personal travel content only |
| apify/instagram-profile-scraper | josefburyan | 1 | 0.0023 | Low. Account is private. Bio and follower counts are public, posts must be ignored |
| clockworks/tiktok-profile-scraper | josefburyan (handle guessed, not in SERP) | 1 | 0.0020 | Dead. Private account, 0 videos. Handle match is unverified, so do not cite |
| apify/facebook-pages-scraper | facebook.com/josefburyan | 1 | 0.0082 | Yes, small. Work, school, hometown, 395 followers from the public profile header |
| apify/website-content-crawler | 5 URLs from the SERP, depth 0 | 5 | 0.0020 | 3 of 5. Google for Business article (5.5k chars), Aktin press release, CzechCrunch interview (12k chars). The personal domain is a parked page and the Seznam podcast page is a consent wall |
| apify/google-news-scraper | existence check | 0 | 0 | Does not exist (HTTP 404, also under lukaskrivka). A SERP query with "zprávy OR news" returned 7 hits, all already seen |
| **Total** | 12 successful runs | | **0.152** | cap was 1.50 |

One run failed before starting: the SERP actor refuses a cap under $0.50 (`max-total-charge-usd-below-minimum`). The first attempt at 0.10 cost nothing. The repo adapter `src/adapters/apify.ts` already floors the cap at 0.50, so production is fine. Real spend stayed at $0.02.

## 2. Brief sections the data supports

Each section lists sources, example evidence, and the gap. Evidence snippets are short quotes of public text.

### A. Identity and current role (strong)
- Sources: LinkedIn profile, Groupon people page in SERP, Facebook header, X bio, Instagram bio, Google for Business article.
- Evidence: LinkedIn headline "CMO, Groupon (NASDAQ: GRPN)" (https://www.linkedin.com/in/josef-buryan). X bio "CMO at @Groupon" (https://x.com/josefburyan). Facebook "Chief marketing officer at Groupon" (https://www.facebook.com/josefburyan/).
- Five independent sources agree, which is the basis for a high identity merge confidence.
- Gap: no government or registry source. Name is rare, but the SERP also shows an unrelated election-results page for the same name (see Namesakes).

### B. Career history (strong)
- Sources: LinkedIn experience (7 roles), Aktin press release 2022-04-13, CzechCrunch interview, Google for Business article.
- Evidence: LinkedIn "Chief Marketing Officer, Groupon, Feb 2025 to present". Aktin: "Josef Buryan přišel z evropské centrály Meta, kde poslední 3 roky vedl globální MarTech projekty" (https://aktin.cz/marketing-aktinu-vede-josef-buryan-prisel-z-evropske-centraly-meta).
- Gap: no employer-side confirmation for Tipli, 5DM, eProvement. Dates come from the person's own profile.

### C. Education and credentials (medium)
- Sources: LinkedIn education (MBA University of St. Francis 2022 to 2024, Masaryk University master's and bachelor's), certifications list, Facebook "Studied Service science, management and engineering at Masaryk University".
- Evidence: bachelor thesis listed under LinkedIn publications ("Application of Digital Marketing in the promotion of cloud BPM platform", 2015).
- Gap: no registry or university confirmation of degrees. Certifications are self-listed.

### D. Current employer context (strong)
- Sources: LinkedIn company page, LinkedIn about text, Google for Business article, his own posts (Q2 results, transformation posts).
- Evidence: company page "Scroll less, live more!", public company, 10298 employees listed. His about: "I lead an 11-team, full-funnel organization serving more than 16 million active customers".
- Gap: no financial filing or investor source was scraped. Needs SEC or investor-relations fetch for hard company numbers.

### E. PR and press (medium)
- Sources: SERP, CzechCrunch (cc.cz), Aktin press release, Google for Business case article, Bloomberg profile page (listed, not fetched).
- Evidence: CzechCrunch: "Pokud jste velká firma ze střední Evropy, která utrácí za reklamy na Facebooku, dost možná jste při práci mohli narazit na Josefa Buryana" (https://cc.cz/facebook-je-jiny-nez-zvenci-vypada-rika-jeho-byvaly-cesky-manazer-zevnitr-vidite-ze-mu-na-lidech-zalezi/).
- Gap: press is 2022 and 2026 only, nothing between. Press pages carry no machine date, only text, so retrieval date must stand in.

### F. Interviews and podcasts (medium, thin)
- Sources: YouTube search, SERP (Seznam podcasts, Apple Podcasts, Deezer mirrors).
- Evidence: "88 exec talks live: Josef Buryan (CMO, Groupon)" by Shopsys, 41 min, published 2026-10-04 (https://www.youtube.com/watch?v=X8FlikWYuog). The video description names Meta Dublin, Vilgain and Groupon as his three budget environments.
- Gap: no transcript. Podcast page was a consent wall. A transcript or caption fetch is the missing step.

### G. Talks and conferences (dead)
- The query "konference OR přednáška OR talk" returned 9 generic hits, none about him. Report this as a stated gap, not as "none exist".

### H. Writing and themes (strong)
- Sources: 30 LinkedIn posts (2026-06-30 to 2026-10-01), 1 article mention, tweets.
- Themes visible in the text: AI-first marketing organisation, paid media on AI surfaces (ChatGPT Ads), Groupon transformation and brand, hiring and screening, marketing career advice, personal failure post. 28 own posts plus 2 reposts.
- Evidence: "We have been buying ChatGPT Ads since April." (https://www.linkedin.com/posts/josef-buryan_we-have-been-buying-chatgpt-ads-since-april-activity-7497947634121285632-fqQ6, 103 likes, 5 comments). "Groupon is now inside ChatGPT and Claude." (2026-09-15).
- Relevant to hackathon: a 2026-09-24 post announces an "Old Boys Squad" for a Prague AI-agent hackathon.
- Gap: posts older than the last 30 not fetched. Article full text not fetched. Reposts must be tagged as not his authorship (the "Three years ago I joined Groupon from Slevomat" post is another person's).

### I. Social presence per platform (strong for 3 of 6)
| Platform | Handle | Size | Status |
|---|---|---|---|
| LinkedIn | josef-buryan | 5076 followers, 4036 connections | active, 30 posts in 3 months |
| X | @josefburyan | 2402 followers | active, replies, joined 2009 |
| Facebook | josefburyan | 395 followers | public header only |
| Instagram | @josefburyan | 162 followers | private, bio only |
| YouTube | josefburyan6158 | 157 subscribers, 20 videos | personal travel, last upload old |
| TikTok | josefburyan (guess) | 16 fans | private, unverified |
- Gap: TikTok and Instagram content not usable. Cross-platform identity for X, Instagram and Facebook rests on the shared personal domain josefburyan.cz in bio fields plus matching name and employer.

### J. Location (medium)
- LinkedIn "Prague, Czechia"; Facebook hometown Třinec; Aktin article "Rodák z Třince".
- Gap: current residence is only self-reported.

### K. Community, volunteering, projects (thin)
- LinkedIn volunteering: Digital Marketing Mentor for a family bookshop in Wrocław (2020 to 2022). Projects: PlnaPenezenka.cz, TopSleva.cz, Birell. No awards.
- Gap: honors list empty, no board seats found.

### L. Public code (dead for this subject)
- No GitHub, Stack Exchange or OpenAlex query was in this scrape. The SERP did not surface any. Keep the existing collectors, expect empty for a marketing role.

### M. Contradictions and checks (found by comparing sources)
- Vilgain CMO starts Feb 2022 on LinkedIn, but the Aktin press release dated 2022-04-13 announces the new CMO as arriving from Meta, and LinkedIn has Meta ending Apr 2022 (2 months overlap). Aktin and Vilgain appear to be the same company renamed, which the SERP post titles ("update-aktin-vilgain") hint at. Present as a date discrepancy and a probable rename, both INFERENCE.
- Facebook work line "Former Client Solutions Manager, CEE at Facebook" versus LinkedIn "Commerce Manager, Global Business Group" for the last Meta role: Facebook shows an older title.
- Reposts in the feed show claims (Slevomat to Groupon) that are not about him.

### N. Namesakes and exclusions
- `kurzy.cz/volby/josef-buryan` is an election results page. It carries political data (GDPR Art. 9 territory) and no link to this person. Do not fetch, do not attribute. Treat as a namesake candidate that must be dropped, not resolved.
- `theses.cz` Twitter sentiment thesis hit is unrelated.
- RocketReach and Bloomberg profile pages are aggregators, not primary. Do not cite contact data.

## 3. Recommended recipe changes

Steps and queries that worked:
- SERP is the discovery hub. These queries paid off: `"Josef Buryan"`, `... instagram OR twitter OR x.com OR tiktok OR youtube OR facebook` (found X, Facebook, YouTube channel, Instagram), `... site:linkedin.com/posts`, `... rozhovor OR interview OR podcast`, `... Groupon`. Cost is 0.0025 per page.
- Add one `social_from_serp` step: take handles from SERP URLs on x.com, instagram.com, facebook.com, youtube.com and pass them to the platform collectors. Today collectors guess the handle from the name.
- Add a LinkedIn posts step (harvestapi/linkedin-profile-posts, 30 posts, 0.06). It is the most expensive item here and the best source for a "Writing and themes" section for a CMO goal.
- Keep website crawler for press URLs picked from the SERP by domain type (news, company blog), not for personal domains. Skip pages whose text is under 500 chars or hit a consent wall, and record a gap.
- Podcast and video transcript step: for a YouTube or podcast hit with the subject name in the title, fetch captions. Not tested here.

Dead or low value for this subject:
- apify/google-news-scraper does not exist. Do not add it.
- TikTok: private account, and the handle was a guess. Run only when a handle comes from the SERP, and treat `private: true` as a gap.
- Instagram: `private: true` yet the actor still returned 2 recent posts. The collector must drop posts when `private` is true.
- Conference and talk SERP query returned noise for a rare-name subject. Narrow it with the employer or drop it; state "no public talk found" as a gap.
- YouTube channel run added nothing the search run did not already have.

Guardrails to add to the collectors:
- Drop any SERP hit on election or political registers and any result about a private-person list. Never turn them into claims.
- Mark reposted LinkedIn posts (`repostedBy` or author differs from the subject) so they never become claims about the subject.
- Re-read the run record for cost after a pay-per-event run. The immediate `.call()` return can show 0.

## 4. Ledger line

Appended to `docs/ops/llm-manual-runs.md`: lane Apify pay-per-event, no LLM, actual billed $0.152 across 12 runs.
