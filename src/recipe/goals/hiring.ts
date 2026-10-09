/**
 * Hiring recipe: what a recruiter needs to know about a person, and which sources answer it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/goals/hiring.ts
 * Deps:    src/recipe/sources/personal-site (PERSONAL_SITE_ACTOR)
 * Tested:  src/recipe/__tests__/goals.test.ts
 *
 * Key responsibilities:
 * - Question list and ordered step list for goal "hiring"; `seed_profile` first (manager's LinkedIn URL or CV, plans/006)
 * - One question per brief section: role, employer context, career, education, code, code contributions, talks, writing,
 *   press, social presence, community and awards, location, contradictions
 * - Paid actor runs stay under RUN_BUDGET_CALLS (18), and the extra web searches are packed as
 *   several queries into one SERP run (social_serp: one `site:` query per platform, press_serp, talks_serp)
 * - Instagram and Facebook are always searched by name on the platform itself (`instagram_search`, `facebook_search`,
 *   before the lineup, so the accounts found are scored against the anchor and the confirmed employers like any other
 *   hit); the profile steps after the lineup then scrape the confirmed and possibly-same-as accounts
 * - For a technical role GitHub is searched by name the same way (`github_search`, free REST) and the lineup pauses for
 *   the manager when the account found is only possibly-same-as, so the deep steps get a confirmed handle
 * - `github_deep` (technical roles only: engineering, data; src/domain/code-profile TECHNICAL_FAMILIES) scrapes every confirmed GitHub account in depth;
 *   `github_apify` then adds the profile page's own numbers (saswave/github-profile-scraper)
 * - `personal_site_crawl` (PERSONAL_SITE_ACTOR, src/recipe/sources/personal-site): crawls a site whose domain is the
 *   subject's name (robertvojacek.cz) found among the hits; its pages are the subject's own writing (merged)
 * - `role_sites_serp`: the matched role template's evidence sites (src/domain/role-catalog) as one `site:` search
 * - Depth (plans/013): free REST collectors `sec_edgar` (SEC EDGAR full-text search), `wikipedia` (en + cs), `podcast_episodes`
 *   (Apple Podcasts index); four more packed SERP steps (regulatory_serp, legal_serp, business_press_serp, boards_serp); and
 *   `read_pages` (`rest/read-pages`) last before extract: fetches the confirmed web pages and replaces their SERP snippets with
 *   the page text around the person's name, so extract reads articles and filings, not snippets
 * - `cz_registries` (`rest/cz-registries`): Czech public registries for every position (insolvency, ARES, public register
 *   persons, Police wanted list) plus the chamber the role title names (src/domain/cz-registry); free REST / HTML, no Apify
 *
 * Design constraints:
 * - Must call `github_profile`; must never call the company ARES steps (`kind: "ares"`, due-diligence's); the person check
 *   in `cz_registries` is a different question (records under the candidate's name)
 * - Shares fewer than half of its step ids with due-diligence (goal switch must change substance)
 */
import { PERSONAL_SITE_ACTOR } from "@/recipe/sources/personal-site";
import type { Recipe } from "@/recipe/step";

export const hiringRecipe: Recipe = {
  goal: "hiring",
  questions: [
    { id: "current-role", text: "What is the subject's current role and employer?" },
    { id: "employer-context", text: "What does the current employer do, how large is it and where is it based, per its own pages?" },
    { id: "career-history", text: "What roles and tenures precede it?" },
    { id: "education", text: "What education, degrees or certifications are stated?" },
    { id: "public-code", text: "What public code or technical output exists (GitHub, packages)?" },
    { id: "code-contributions", text: "What do the candidate's public code contributions show: own repositories, lines added and removed, commits, pull requests merged into other projects, main languages, how recent the activity is?", title: "Code contributions" },
    { id: "public-talks", text: "What public talks, podcasts, webinars or conference appearances feature them?" },
    { id: "writing", text: "What have they written or published (LinkedIn posts, articles, blogs, papers)?" },
    { id: "press", text: "What do press articles, interviews or press releases say about them?" },
    { id: "social-presence", text: "Which social profiles are theirs, what topics do they post about, and how often?" },
    { id: "community", text: "What community roles, awards, volunteering or mentoring are documented?" },
    { id: "location-match", text: "Does their stated location match the anchor?" },
    { id: "regulatory-filings", text: "Which regulatory or stock-market filings (SEC EDGAR, stock exchange notices, proxy statements, Schedule 13D or 13G, Form 4), shareholdings, board seats or investment vehicles name them, and what do those documents state?", title: "Filings and markets" },
    { id: "legal-record", text: "Which court cases, insolvency or enforcement proceedings, regulatory penalties, sanctions or disputes name them in public records or press, and what is stated?", title: "Legal record" },
    { id: "public-registries", text: "What do Czech public registries list under the candidate's name: insolvency proceedings, own businesses or statutory-body seats, the Police wanted list, and the professional chamber the role requires?", title: "Public registries" },
    { id: "contradictions", text: "Which sources disagree with each other?" },
  ],
  steps: [
    { id: "seed_profile", kind: "seed" },
    { id: "serp_person", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor}\n{subject}', onEmpty: { gap: "no search hits for subject + anchor" } },
    {
      id: "social_serp",
      kind: "serp",
      actor: "apify/google-search-scraper",
      query: '{subject} linkedin\n"{subject}" site:instagram.com\n"{subject}" site:facebook.com\n"{subject}" site:github.com\n"{subject}" site:x.com OR site:twitter.com OR site:tiktok.com OR site:youtube.com',
      onEmpty: { gap: "no social profiles indexed by Google" },
    },
    { id: "instagram_search", kind: "actor", actor: "apify/instagram-scraper", onEmpty: { gap: "Instagram profile search found no account under the candidate's name" } },
    { id: "facebook_search", kind: "actor", actor: "apify/facebook-search-scraper", onEmpty: { gap: "Facebook people search found no profile under the candidate's name" } },
    { id: "github_search", kind: "actor", actor: "rest/github-search", onEmpty: { gap: "GitHub user search found no account under the candidate's name (technical roles only)" } },
    { id: "resolve_lineup", kind: "resolve" },
    { id: "linkedin_profile", kind: "actor", actor: "harvestapi/linkedin-profile-scraper", onEmpty: { gap: "no LinkedIn profile URL known or profile not scrapable" } },
    { id: "sec_edgar", kind: "actor", actor: "rest/sec-edgar", onEmpty: { gap: "no SEC EDGAR filing names them" } },
    { id: "wikipedia", kind: "actor", actor: "rest/wikipedia", onEmpty: { gap: "no Wikipedia article (English or Czech) names them in full" } },
    { id: "podcast_episodes", kind: "actor", actor: "rest/podcasts", onEmpty: { gap: "no podcast episode in the Apple Podcasts index names them" } },
    { id: "linkedin_posts", kind: "actor", actor: "harvestapi/linkedin-profile-posts", onEmpty: { gap: "no public LinkedIn posts found" } },
    { id: "employer_company", kind: "actor", actor: "harvestapi/linkedin-company", onEmpty: { gap: "no LinkedIn company page for the current employer" } },
    { id: "github_profile", kind: "actor", actor: "rest/github", onEmpty: { gap: "no public GitHub profile found" } },
    { id: "github_deep", kind: "actor", actor: "rest/github-deep", onEmpty: { gap: "no public GitHub contribution statistics (role not technical, no confirmed GitHub account, or statistics not ready)" } },
    { id: "github_apify", kind: "actor", actor: "saswave/github-profile-scraper", onEmpty: { gap: "GitHub profile page not scraped (role not technical or no confirmed GitHub account)" } },
    { id: "stackexchange_profile", kind: "actor", actor: "rest/stackexchange", onEmpty: { gap: "no Stack Exchange activity found" } },
    { id: "huggingface_profile", kind: "actor", actor: "rest/huggingface", onEmpty: { gap: "no Hugging Face models or datasets found" } },
    { id: "orcid_search", kind: "actor", actor: "rest/orcid", onEmpty: { gap: "no ORCID record found" } },
    { id: "openalex_author", kind: "actor", actor: "rest/openalex", onEmpty: { gap: "no OpenAlex author record found" } },
    { id: "x_profile", kind: "actor", actor: "apidojo/tweet-scraper", onEmpty: { gap: "no public X profile found" } },
    { id: "instagram_profile", kind: "actor", actor: "apify/instagram-profile-scraper", onEmpty: { gap: "no public Instagram profile under the candidate's name (Instagram search and web search)" } },
    { id: "tiktok_profile", kind: "actor", actor: "clockworks/tiktok-profile-scraper", onEmpty: { gap: "no public TikTok profile found" } },
    { id: "youtube_channel", kind: "actor", actor: "streamers/youtube-scraper", onEmpty: { gap: "no YouTube videos or channel found" } },
    { id: "facebook_page", kind: "actor", actor: "apify/facebook-pages-scraper", onEmpty: { gap: "no public Facebook page or profile under the candidate's name (Facebook search and web search)" } },
    { id: "bluesky_profile", kind: "actor", actor: "rest/bluesky", onEmpty: { gap: "no Bluesky account found" } },
    { id: "personal_site_crawl", kind: "actor", actor: PERSONAL_SITE_ACTOR, onEmpty: { gap: "no personal site found" } },
    { id: "role_sites_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {role_sites}', onEmpty: { gap: "no hits on the role's evidence sites (or the role matched no template)" } },
    { id: "cz_registries", kind: "actor", actor: "rest/cz-registries", onEmpty: { gap: "Czech public registries not checked (name could not be split into given name and surname)" } },
    { id: "talks_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" talk OR podcast OR conference OR webinar OR přednáška\n"{subject}" blog OR article OR medium.com OR substack.com', onEmpty: { gap: "no talks, podcasts or articles found in web search" } },
    { id: "press_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" interview OR rozhovor OR "tisková zpráva" OR "press release"\n"{subject}" award OR ocenění OR volunteer OR mentor OR meetup', onEmpty: { gap: "no press, awards or community mentions found in web search" } },
    { id: "regulatory_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" site:sec.gov OR "Schedule 13D" OR "proxy statement" OR "SEC filing" OR shareholder OR akcionář\n"{subject}" shares OR stock OR akcie OR investor OR fund OR "private equity" OR acquisition OR akvizice OR IPO', onEmpty: { gap: "no regulatory or stock-market pages name them" } },
    { id: "legal_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" lawsuit OR court OR žaloba OR soud OR arbitráž OR insolvence OR exekuce OR sanctions OR fine OR pokuta OR regulator', onEmpty: { gap: "no court, insolvency or enforcement pages name them" } },
    { id: "business_press_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" site:hn.cz OR site:e15.cz OR site:seznamzpravy.cz OR site:forbes.cz OR site:czechcrunch.cz OR site:lupa.cz OR site:idnes.cz OR site:novinky.cz OR site:ekonom.cz\n"{subject}" site:bloomberg.com OR site:reuters.com OR site:ft.com OR site:wsj.com OR site:techcrunch.com OR site:businessinsider.com OR site:cnbc.com OR site:forbes.com', onEmpty: { gap: "no business-press pages name them" } },
    { id: "boards_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" "board of directors" OR "board member" OR "dozorčí rada" OR představenstvo OR jednatel OR founder OR zakladatel OR partner OR CEO\n"{subject}" wikipedia OR crunchbase OR "about us" OR tým OR team OR "o nás"', onEmpty: { gap: "no board, founder or team pages name them" } },
    { id: "read_pages", kind: "actor", actor: "rest/read-pages", onEmpty: { gap: "no confirmed web pages to read in full" } },
    { id: "extract_claims", kind: "extract" },
    { id: "verify_claims", kind: "verify" },
    { id: "synthesize_report", kind: "synthesize" },
  ],
};
