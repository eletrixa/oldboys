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
    { id: "serp_person", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor}', onEmpty: { gap: "no search hits for subject + anchor" } },
    { id: "resolve_lineup", kind: "resolve" },
    { id: "linkedin_profile", kind: "actor", actor: "apify/linkedin-profile-scraper", onEmpty: { fallbackStep: "serp_person" } },
    { id: "github_profile", kind: "actor", actor: "apify/github-profile-scraper", onEmpty: { gap: "no public GitHub profile found" } },
    { id: "x_profile", kind: "actor", actor: "apify/twitter-scraper", onEmpty: { gap: "no public X profile found" } },
    { id: "personal_site_crawl", kind: "actor", actor: "apify/website-content-crawler", onEmpty: { gap: "no personal site found" } },
    { id: "talks_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor} talk OR podcast OR conference OR blog OR interview', onEmpty: { gap: "no talks or posts indexed" } },
    { id: "extract_claims", kind: "extract" },
    { id: "verify_claims", kind: "verify" },
    { id: "synthesize_report", kind: "synthesize" },
  ],
};
