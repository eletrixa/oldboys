/**
 * Due-diligence recipe: what an investor or buyer needs to know about a company (or its people).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/goals/due-diligence.ts
 * Deps:    none
 * Tested:  src/recipe/__tests__/goals.test.ts
 *
 * Key responsibilities:
 * - Question list and ordered step list for goal "due-diligence"
 * - treg second source (plans/016): `treg_company_enrich` reads the anchor domain's company record (The Companies API)
 *   and `treg_social_verify` reads the confirmed accounts a second time through an independent provider
 *
 * Design constraints:
 * - Must call `ares_vr` (Czech registry statutory bodies); must never call `github_profile`
 * - Shares fewer than half of its step ids with hiring (goal switch must change substance)
 */
import type { Recipe } from "@/recipe/step";

export const dueDiligenceRecipe: Recipe = {
  goal: "due-diligence",
  questions: [
    { id: "legal-entity", text: "Which registered legal entity is this (name, IČO, legal form)?" },
    { id: "statutory-bodies", text: "Who are the statutory bodies and owners, and since when?" },
    { id: "registered-address", text: "Does the registered address match the anchor?" },
    { id: "legal-signals", text: "Are there insolvency, litigation or dissolution signals?" },
    { id: "public-reputation", text: "What do news and reviews say about the entity?" },
    { id: "social-consistency", text: "Do social profiles agree with the registry on activity and scale?" },
    { id: "contradictions", text: "Which sources disagree with each other?" },
  ],
  steps: [
    { id: "serp_org", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor}\n{subject}', onEmpty: { gap: "no search hits for subject + anchor" } },
    { id: "resolve_lineup", kind: "resolve" },
    { id: "ares_subjekty", kind: "ares", actor: "ares/ekonomicke-subjekty/vyhledat", onEmpty: { gap: "no ARES entity matched" } },
    { id: "ares_vr", kind: "ares", actor: "ares/ekonomicke-subjekty-vr", onEmpty: { gap: "no public register record for IČO" } },
    { id: "justice_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" insolvence OR likvidace OR exekuce OR soud', onEmpty: { gap: "no insolvency or court hits" } },
    { id: "linkedin_company", kind: "actor", actor: "harvestapi/linkedin-company", onEmpty: { fallbackStep: "serp_org" } },
    { id: "treg_company_enrich", kind: "actor", actor: "treg/company-enrich", onEmpty: { gap: "no company record for the anchor domain (The Companies API via treg)" } },
    { id: "instagram_profile", kind: "actor", actor: "apify/instagram-profile-scraper", onEmpty: { gap: "no public Instagram profile" } },
    { id: "treg_social_verify", kind: "actor", actor: "treg/social-verify", onEmpty: { gap: "no confirmed public account could be read a second time by an independent provider (treg)" } },
    { id: "company_site_crawl", kind: "actor", actor: "apify/website-content-crawler", onEmpty: { gap: "no company website found" } },
    { id: "news_serp", kind: "serp", actor: "apify/google-search-scraper", query: '"{subject}" {anchor} news OR zprávy OR recenze', onEmpty: { gap: "no news coverage indexed" } },
    { id: "extract_claims", kind: "extract" },
    { id: "verify_claims", kind: "verify" },
    { id: "synthesize_report", kind: "synthesize" },
  ],
};
