/**
 * Hiring recipe: what a recruiter needs to know about a person, and which sources answer it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/goals/hiring.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/goals.test.ts
 *
 * Key responsibilities:
 * - Question list and ordered step list for goal "hiring"; `seed_profile` first (manager's LinkedIn URL or CV, plans/006)
 * - `github_deep` (technical roles only: engineering, data; src/domain/code-profile TECHNICAL_FAMILIES) scrapes every confirmed GitHub account in depth;
 *   `github_apify` then adds the profile page's own numbers (saswave/github-profile-scraper)
 * - `role_sites_serp`: the matched role template's evidence sites (src/domain/role-catalog) as one `site:` search
 * - `cz_registries` (`rest/cz-registries`): Czech public registries for every position (insolvency, ARES, public register
 *   persons, Police wanted list) plus the chamber the role title names (src/domain/cz-registry); free REST / HTML, no Apify
 *
 * Design constraints:
 * - Must call `github_profile`; must never call the company ARES steps (`kind: "ares"`, due-diligence's); the person check
 *   in `cz_registries` is a different question (records under the candidate's name)
 * - Shares fewer than half of its step ids with due-diligence (goal switch must change substance)
 */
import type { Recipe } from "@/recipe/step";

export const hiringRecipe: Recipe = {
  goal: "hiring",
  questions: [
    { id: "current-role", text: "What is the subject's current role and employer?" },
    { id: "career-history", text: "What roles and tenures precede it?" },
    { id: "public-code", text: "What public code or technical output exists (GitHub, packages)?" },
    { id: "code-contributions", text: "What do the candidate's public code contributions show: own repositories, lines added and removed, commits, pull requests merged into other projects, main languages, how recent the activity is?", title: "Code contributions" },
    { id: "public-talks", text: "What public talks, posts or writing show how they think?" },
    { id: "location-match", text: "Does their stated location match the anchor?" },
    { id: "public-registries", text: "What do Czech public registries list under the candidate's name: insolvency proceedings, own businesses or statutory-body seats, the Police wanted list, and the professional chamber the role requires?", title: "Public registries" },
    { id: "contradictions", text: "Which sources disagree with each other?" },
  ],
  steps: [
    { id: "seed_profile", kind: "seed" },
    { id: "serp_person", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor}\n{subject}', onEmpty: { gap: "no search hits for subject + anchor" } },
    { id: "social_serp", kind: "serp", actor: "apify/google-search-scraper", query: '{subject} linkedin\n{subject} instagram OR twitter OR tiktok OR github', onEmpty: { gap: "no social profiles indexed by Google" } },
    { id: "resolve_lineup", kind: "resolve" },
    { id: "linkedin_profile", kind: "actor", actor: "harvestapi/linkedin-profile-scraper", onEmpty: { gap: "no LinkedIn profile URL known or profile not scrapable" } },
    { id: "github_profile", kind: "actor", actor: "rest/github", onEmpty: { gap: "no public GitHub profile found" } },
    { id: "github_deep", kind: "actor", actor: "rest/github-deep", onEmpty: { gap: "no public GitHub contribution statistics (role not technical, no confirmed GitHub account, or statistics not ready)" } },
    { id: "github_apify", kind: "actor", actor: "saswave/github-profile-scraper", onEmpty: { gap: "GitHub profile page not scraped (role not technical or no confirmed GitHub account)" } },
    { id: "stackexchange_profile", kind: "actor", actor: "rest/stackexchange", onEmpty: { gap: "no Stack Exchange activity found" } },
    { id: "huggingface_profile", kind: "actor", actor: "rest/huggingface", onEmpty: { gap: "no Hugging Face models or datasets found" } },
    { id: "orcid_search", kind: "actor", actor: "rest/orcid", onEmpty: { gap: "no ORCID record found" } },
    { id: "openalex_author", kind: "actor", actor: "rest/openalex", onEmpty: { gap: "no OpenAlex author record found" } },
    { id: "x_profile", kind: "actor", actor: "apidojo/tweet-scraper", onEmpty: { gap: "no public X profile found" } },
    { id: "instagram_profile", kind: "actor", actor: "apify/instagram-profile-scraper", onEmpty: { gap: "no public Instagram profile" } },
    { id: "tiktok_profile", kind: "actor", actor: "clockworks/tiktok-profile-scraper", onEmpty: { gap: "no public TikTok profile found" } },
    { id: "youtube_channel", kind: "actor", actor: "streamers/youtube-scraper", onEmpty: { gap: "no YouTube videos or channel found" } },
    { id: "bluesky_profile", kind: "actor", actor: "rest/bluesky", onEmpty: { gap: "no Bluesky account found" } },
    { id: "personal_site_crawl", kind: "actor", actor: "apify/website-content-crawler", onEmpty: { gap: "no personal site found" } },
    { id: "role_sites_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {role_sites}', onEmpty: { gap: "no hits on the role's evidence sites (or the role matched no template)" } },
    { id: "cz_registries", kind: "actor", actor: "rest/cz-registries", onEmpty: { gap: "Czech public registries not checked (name could not be split into given name and surname)" } },
    { id: "talks_serp", kind: "serp", actor: "apify/google-search-scraper", query: '{subject} talk OR podcast OR conference OR blog OR interview', onEmpty: { gap: "no talks, podcasts or posts found in web search" } },
    { id: "extract_claims", kind: "extract" },
    { id: "verify_claims", kind: "verify" },
    { id: "synthesize_report", kind: "synthesize" },
  ],
};
