/**
 * Hiring recipe: what a recruiter needs to know about a person, and which sources answer it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/goals/hiring.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/goals.test.ts
 *
 * Key responsibilities:
 * - Question list and ordered step list for goal "hiring"
 *
 * Design constraints:
 * - Must call `github_profile`; must never call ARES (that is due-diligence's step)
 * - Shares fewer than half of its step ids with due-diligence (goal switch must change substance)
 */
import type { Recipe } from "@/recipe/step";

export const hiringRecipe: Recipe = {
  goal: "hiring",
  questions: [
    { id: "current-role", text: "What is the subject's current role and employer?" },
    { id: "career-history", text: "What roles and tenures precede it?" },
    { id: "public-code", text: "What public code or technical output exists (GitHub, packages)?" },
    { id: "public-talks", text: "What public talks, posts or writing show how they think?" },
    { id: "location-match", text: "Does their stated location match the anchor?" },
    { id: "contradictions", text: "Which sources disagree with each other?" },
  ],
  steps: [
    { id: "serp_person", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor}\n{subject}', onEmpty: { gap: "no search hits for subject + anchor" } },
    { id: "social_serp", kind: "serp", actor: "apify/google-search-scraper", query: '{subject} linkedin\n{subject} instagram OR twitter OR tiktok OR github', onEmpty: { gap: "no social profiles indexed by Google" } },
    { id: "resolve_lineup", kind: "resolve" },
    { id: "linkedin_profile", kind: "actor", actor: "harvestapi/linkedin-profile-scraper", onEmpty: { gap: "no LinkedIn profile URL known or profile not scrapable" } },
    { id: "github_profile", kind: "actor", actor: "rest/github", onEmpty: { gap: "no public GitHub profile found" } },
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
    { id: "talks_serp", kind: "serp", actor: "apify/google-search-scraper", query: '{subject} talk OR podcast OR conference OR blog OR interview', onEmpty: { gap: "no talks or posts indexed" } },
    { id: "extract_claims", kind: "extract" },
    { id: "verify_claims", kind: "verify" },
    { id: "synthesize_report", kind: "synthesize" },
  ],
};
