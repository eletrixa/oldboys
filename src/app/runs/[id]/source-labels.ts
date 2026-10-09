/**
 * Plain names for the actor ids a source came from.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/source-labels.ts
 * Deps:    none
 * Tested:  n/a (static map)
 *
 * Key responsibilities:
 * - STEP_LABEL: actor or REST id to plain name, shared by the report page (parts.tsx) and the audit page
 *
 * Design constraints:
 * - Pure data, no "use client": importable from server and client components
 */
export const STEP_LABEL: Record<string, string> = {
  "apify/google-search-scraper": "Web search",
  "harvestapi/linkedin-profile-scraper": "LinkedIn",
  "apimaestro/linkedin-profile-detail": "LinkedIn",
  "harvestapi/linkedin-company": "LinkedIn company",
  "rest/github": "GitHub",
  "rest/github-deep": "GitHub contributions",
  "rest/github-search": "GitHub search",
  "saswave/github-profile-scraper": "GitHub profile page",
  "rest/cz-registries": "Czech public registries",
  "apify/instagram-scraper": "Instagram search",
  "apify/facebook-search-scraper": "Facebook search",
  "apify/facebook-pages-scraper": "Facebook page",
  "harvestapi/linkedin-profile-posts": "LinkedIn posts",
  "rest/stackexchange": "Stack Exchange",
  "rest/huggingface": "Hugging Face",
  "rest/orcid": "ORCID",
  "rest/openalex": "OpenAlex",
  "apidojo/tweet-scraper": "X",
  "apify/instagram-profile-scraper": "Instagram",
  "clockworks/tiktok-profile-scraper": "TikTok",
  "streamers/youtube-scraper": "YouTube",
  "rest/bluesky": "Bluesky",
  "apify/website-content-crawler": "Website",
  "rest/sec-edgar": "SEC EDGAR filings",
  "rest/wikipedia": "Wikipedia",
  "rest/podcasts": "Podcasts",
  "rest/read-pages": "Page reading",
  "apify/website-content-crawler#personal-site": "Personal website",
  // treg second source (plans/016)
  "treg/person-enrich": "People enrichment (Apollo via treg)",
  "treg/people-search": "LinkedIn people search (Exa via treg)",
  "treg/social-verify": "Second read of confirmed accounts (treg)",
  "treg/company-enrich": "Company record (The Companies API via treg)",
  "ares/ekonomicke-subjekty/vyhledat": "ARES registry",
  "ares/ekonomicke-subjekty-vr": "ARES public register",
};
