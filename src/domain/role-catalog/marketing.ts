/**
 * Role catalog: marketing family templates (brand, performance, content, SEO, social, PR, CRM, analytics, events).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/marketing.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `MARKETING`: preselected marketing roles with EN/CZ aliases, observable must-haves and a public evidence plan
 *
 * Design constraints:
 * - Relative imports only (plain Node loads the catalog)
 * - Must-haves are observable from public web evidence; no follower-count thresholds as hard criteria;
 *   never health, politics, religion, ethnicity, sexuality, age, family, personality, culture fit or trustworthiness
 */
import type { RoleTemplate } from "./types";

export const MARKETING: RoleTemplate[] = [
  {
    key: "marketing-manager",
    title: "Marketing Manager",
    family: "marketing",
    aliases: ["marketingový manažer", "marketingová manažerka", "marketing lead", "vedoucí marketingu"],
    profile: "track-record",
    must_haves: [
      { id: "mh-marketing-role-history", title: "Marketing role history", text: "Held a named marketing management role at a verifiable company", accepted_evidence: ["job history", "company page", "talk"] },
      { id: "mh-campaigns-run", title: "Campaigns run", text: "Public record of campaigns they led or contributed to", accepted_evidence: ["campaign", "case study", "press"] },
      { id: "mh-multichannel", title: "Multichannel experience", text: "Work spans at least two channels, e.g. paid, content, email or events", accepted_evidence: ["case study", "job history", "campaign"] },
      { id: "mh-marketing-voice", title: "Public marketing voice", text: "Has articles, talks or interviews on marketing practice", accepted_evidence: ["published article", "talk", "podcast"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile", "youtube_channel"], sites: ["linkedin.com", "marketingjournal.cz", "medium.com", "lovebrands.cz"] },
  },
  {
    key: "cmo",
    title: "Chief Marketing Officer",
    family: "marketing",
    aliases: ["cmo", "head of marketing", "marketingový ředitel", "ředitel marketingu", "vp marketing", "chief marketer", "marketing director", "director of marketing", "marketingová ředitelka", "vp of marketing"],
    profile: "track-record",
    must_haves: [
      { id: "mh-exec-marketing-role", title: "Executive marketing role", text: "Held a CMO, head or director of marketing role at a named company", accepted_evidence: ["job history", "company page", "press"] },
      { id: "mh-brand-growth-record", title: "Brand or growth record", text: "Public record of brand launches or growth under their leadership", accepted_evidence: ["case study", "press", "campaign"] },
      { id: "mh-industry-visibility", title: "Industry visibility", text: "Has keynotes, interviews or bylined articles in marketing media", accepted_evidence: ["talk", "podcast", "published article"] },
      { id: "mh-marketing-awards", title: "Recognised campaigns", text: "Led campaigns that won an award or earned press coverage", accepted_evidence: ["award", "press", "ranking article"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "youtube_channel", "x_profile", "personal_site_crawl"], sites: ["linkedin.com", "marketingjournal.cz", "mediar.cz", "adsoftheworld.com", "lovebrands.cz"] },
  },
  {
    key: "performance-marketing-manager",
    title: "Performance Marketing Manager",
    family: "marketing",
    aliases: ["performance marketing", "ppc specialista", "ppc manažer", "paid media manager", "specialista online reklamy", "ppc specialist"],
    profile: "makers",
    must_haves: [
      { id: "mh-paid-channels", title: "Paid channel experience", text: "Work history names paid channels managed, e.g. Google Ads, Meta or Sklik", accepted_evidence: ["job history", "case study", "certification"] },
      { id: "mh-measured-results", title: "Measured paid results", text: "Public case study with budget scale and a measured ROAS, CPA or revenue result", accepted_evidence: ["case study", "published article", "talk"] },
      { id: "mh-platform-certs", title: "Platform certifications", text: "Holds a public ad platform certification or partner badge", accepted_evidence: ["certification", "partner badge", "profile"] },
      { id: "mh-ppc-community", title: "PPC community output", text: "Publishes articles or talks on paid media practice", accepted_evidence: ["published article", "talk", "channel"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile", "youtube_channel"], sites: ["linkedin.com", "marketingjournal.cz", "medium.com", "adsoftheworld.com"] },
  },
  {
    key: "seo-specialist",
    title: "SEO Specialist",
    family: "marketing",
    aliases: ["seo specialista", "seo konzultant", "seo manager", "seo expert", "search engine optimization specialist", "seo manažer"],
    profile: "makers",
    must_haves: [
      { id: "mh-seo-case-studies", title: "SEO case studies", text: "Has public case studies with traffic or ranking change on a named site", accepted_evidence: ["case study", "published article", "talk"] },
      { id: "mh-own-ranking-site", title: "Own ranking site", text: "Runs or ran a site that ranks for non-brand search terms", accepted_evidence: ["live site", "ranking article", "SERP result"] },
      { id: "mh-seo-publishing", title: "Publishes on SEO", text: "Writes or speaks publicly on technical or content SEO", accepted_evidence: ["published article", "talk", "channel"] },
      { id: "mh-seo-employer", title: "SEO role history", text: "Work history shows SEO responsibility at a company or agency", accepted_evidence: ["job history", "agency page", "case study"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "talks_serp", "x_profile", "youtube_channel"], sites: ["semrush.com", "ahrefs.com", "moz.com", "linkedin.com", "marketingjournal.cz"] },
  },
  {
    key: "content-marketing-manager",
    title: "Content Marketing Manager",
    family: "marketing",
    aliases: ["content manager", "content marketér", "content marketer", "manažer obsahového marketingu", "content strategist", "obsahový marketér"],
    profile: "makers",
    must_haves: [
      { id: "mh-content-portfolio", title: "Published content portfolio", text: "Has a public body of published articles, guides or newsletters", accepted_evidence: ["published article", "portfolio", "newsletter"] },
      { id: "mh-content-programme", title: "Content programme run", text: "Case study or role history shows an editorial or content programme they ran", accepted_evidence: ["case study", "job history", "published article"] },
      { id: "mh-content-results", title: "Content results shown", text: "Public evidence ties content to traffic, leads or ranking outcomes", accepted_evidence: ["case study", "ranking article", "talk"] },
      { id: "mh-content-channel", title: "Own content channel", text: "Runs a blog, newsletter or channel with published work", accepted_evidence: ["channel", "newsletter", "blog"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "x_profile", "talks_serp", "youtube_channel"], sites: ["medium.com", "substack.com", "linkedin.com", "marketingjournal.cz"] },
  },
  {
    key: "copywriter",
    title: "Copywriter",
    family: "marketing",
    aliases: ["copywriterka", "textař", "textařka", "reklamní textař", "conversion copywriter", "kreativní textař"],
    profile: "makers",
    must_haves: [
      { id: "mh-copy-portfolio", title: "Copy portfolio", text: "Has a public portfolio of published copy for named brands or clients", accepted_evidence: ["portfolio", "published work", "case study"] },
      { id: "mh-copy-formats", title: "Range of formats", text: "Samples cover more than one format, e.g. ads, web, email or long form", accepted_evidence: ["portfolio", "published work", "campaign"] },
      { id: "mh-czech-or-target-language", title: "Target-language samples", text: "Samples are written in the language the role requires", accepted_evidence: ["portfolio", "published work", "live site"] },
      { id: "mh-copy-recognition", title: "Copy recognition", text: "Credited on a campaign with an award or press coverage", accepted_evidence: ["award", "campaign", "press"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "x_profile", "instagram_profile", "talks_serp"], sites: ["linkedin.com", "medium.com", "substack.com", "lovebrands.cz", "adsoftheworld.com"] },
  },
  {
    key: "social-media-manager",
    title: "Social Media Manager",
    family: "marketing",
    aliases: ["správce sociálních sítí", "social media specialista", "smm", "social media specialist", "manažer sociálních sítí", "social media marketér"],
    profile: "audience",
    must_haves: [
      { id: "mh-managed-accounts", title: "Managed brand accounts", text: "Public evidence of brand accounts they managed or posts they created", accepted_evidence: ["channel", "case study", "job history"] },
      { id: "mh-social-campaigns", title: "Social campaigns", text: "Has a published social campaign with format and result described", accepted_evidence: ["campaign", "case study", "portfolio"] },
      { id: "mh-platform-range", title: "Multi-platform work", text: "Work spans at least two platforms such as Instagram, TikTok or LinkedIn", accepted_evidence: ["channel", "campaign", "portfolio"] },
      { id: "mh-own-social-presence", title: "Own active channel", text: "Has a public account with regular published content on a platform", accepted_evidence: ["channel", "profile", "published post"] },
    ],
    sources: { steps: ["instagram_profile", "linkedin_profile", "tiktok_profile", "x_profile", "youtube_channel", "personal_site_crawl"], sites: ["instagram.com", "tiktok.com", "linkedin.com", "lovebrands.cz", "youtube.com"] },
  },
  {
    key: "community-manager",
    title: "Community Manager",
    family: "marketing",
    aliases: ["komunitní manažer", "community manažer", "community specialist", "community lead", "správce komunity", "community builder"],
    profile: "audience",
    must_haves: [
      { id: "mh-community-run", title: "Community they ran", text: "Public evidence of a named community, forum or group they managed", accepted_evidence: ["community page", "job history", "case study"] },
      { id: "mh-community-programmes", title: "Programmes and events", text: "Has run public community events, meetups or programmes", accepted_evidence: ["event page", "talk", "published article"] },
      { id: "mh-community-growth", title: "Community outcomes", text: "Publishes outcomes such as growth, engagement or retention of a community", accepted_evidence: ["case study", "talk", "published article"] },
      { id: "mh-community-content", title: "Community content", text: "Has public posts, moderation guides or write-ups about community practice", accepted_evidence: ["published article", "channel", "talk"] },
    ],
    sources: { steps: ["linkedin_profile", "x_profile", "talks_serp", "youtube_channel", "personal_site_crawl", "instagram_profile"], sites: ["linkedin.com", "meetup.com", "medium.com", "youtube.com"] },
  },
  {
    key: "pr-manager",
    title: "PR Manager",
    family: "marketing",
    aliases: ["pr manažer", "pr specialista", "communications manager", "komunikační manažer", "tiskový mluvčí", "media relations manager"],
    profile: "audience",
    must_haves: [
      { id: "mh-press-coverage", title: "Press coverage secured", text: "Public press coverage traceable to their PR work or named as contact", accepted_evidence: ["press", "press release", "case study"] },
      { id: "mh-pr-employer", title: "PR role history", text: "Work history names a PR or communications role at a company or agency", accepted_evidence: ["job history", "agency page", "company page"] },
      { id: "mh-pr-campaigns", title: "PR campaigns", text: "Has a published PR or communications campaign with outcome described", accepted_evidence: ["campaign", "case study", "award"] },
      { id: "mh-pr-voice", title: "Communications voice", text: "Bylined articles, talks or interviews on communications practice", accepted_evidence: ["published article", "talk", "podcast"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"], sites: ["muckrack.com", "linkedin.com", "mediar.cz", "marketingjournal.cz", "lovebrands.cz"] },
  },
  {
    key: "brand-manager",
    title: "Brand Manager",
    family: "marketing",
    aliases: ["brand manažer", "manažer značky", "brand marketing manager", "brand lead", "category brand manager"],
    profile: "audience",
    must_haves: [
      { id: "mh-managed-brand", title: "Brand they managed", text: "Work history names a brand they managed at a verifiable company", accepted_evidence: ["job history", "company page", "case study"] },
      { id: "mh-brand-campaigns", title: "Published brand campaigns", text: "Public campaigns for that brand credit them or their team", accepted_evidence: ["campaign", "case study", "press"] },
      { id: "mh-brand-recognition", title: "Brand recognition", text: "Brand work received an award, ranking mention or press coverage", accepted_evidence: ["award", "ranking article", "press"] },
      { id: "mh-brand-thinking", title: "Brand thinking shown", text: "Has articles, talks or interviews on brand strategy", accepted_evidence: ["published article", "talk", "podcast"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "instagram_profile", "personal_site_crawl", "x_profile"], sites: ["lovebrands.cz", "adsoftheworld.com", "linkedin.com", "marketingjournal.cz", "mediar.cz"] },
  },
  {
    key: "growth-marketer",
    title: "Growth Marketer",
    family: "marketing",
    aliases: ["growth marketing manager", "growth hacker", "growth manager", "growth lead", "specialista growth marketingu", "growth marketér"],
    profile: "makers",
    must_haves: [
      { id: "mh-growth-results", title: "Growth results shown", text: "Public case study with a measured growth result and the experiment behind it", accepted_evidence: ["case study", "talk", "published article"] },
      { id: "mh-experimentation", title: "Experimentation practice", text: "Describes A/B tests or growth experiments with hypothesis and outcome", accepted_evidence: ["published article", "talk", "case study"] },
      { id: "mh-growth-employer", title: "Growth role history", text: "Work history names a growth role at a product or startup company", accepted_evidence: ["job history", "company page", "profile"] },
      { id: "mh-growth-writing", title: "Growth writing", text: "Writes or speaks publicly about growth channels and funnels", accepted_evidence: ["published article", "newsletter", "talk"] },
    ],
    sources: { steps: ["linkedin_profile", "x_profile", "personal_site_crawl", "talks_serp", "youtube_channel"], sites: ["linkedin.com", "medium.com", "substack.com", "marketingjournal.cz"] },
  },
  {
    key: "crm-marketing-manager",
    title: "Email and CRM Marketing Manager",
    family: "marketing",
    aliases: ["email marketing manager", "crm manažer", "crm marketing manager", "email marketér", "e-mail marketing specialista", "lifecycle marketing manager", "crm specialista"],
    profile: "makers",
    must_haves: [
      { id: "mh-email-programmes", title: "Email programmes run", text: "Work history or case study shows email or CRM programmes they ran", accepted_evidence: ["job history", "case study", "published article"] },
      { id: "mh-crm-tools", title: "Named CRM tools", text: "Public profile or case study names the ESP or CRM platform used", accepted_evidence: ["profile", "case study", "certification"] },
      { id: "mh-lifecycle-results", title: "Lifecycle results shown", text: "Public example with a measured retention, revenue or engagement result", accepted_evidence: ["case study", "talk", "published article"] },
      { id: "mh-email-community", title: "Email community output", text: "Publishes articles or talks on email or lifecycle marketing", accepted_evidence: ["published article", "talk", "newsletter"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "x_profile", "youtube_channel"], sites: ["linkedin.com", "medium.com", "marketingjournal.cz", "substack.com"] },
  },
  {
    key: "marketing-analyst",
    title: "Marketing Analyst",
    family: "marketing",
    aliases: ["marketingový analytik", "marketing analytik", "marketing analytics specialist", "digital analytik", "web analytik", "marketing data analyst"],
    profile: "makers",
    must_haves: [
      { id: "mh-analytics-role", title: "Analytics role history", text: "Work history names a marketing or digital analytics role", accepted_evidence: ["job history", "company page", "profile"] },
      { id: "mh-analytics-tools", title: "Analytics tooling", text: "Public profile or work names tools such as GA4, SQL or a BI platform", accepted_evidence: ["profile", "certification", "case study"] },
      { id: "mh-analysis-published", title: "Published analysis", text: "Has a public analysis, dashboard or write-up on marketing performance", accepted_evidence: ["published article", "case study", "portfolio"] },
      { id: "mh-analytics-community", title: "Analytics community output", text: "Has talks or articles on measurement or attribution", accepted_evidence: ["talk", "published article", "channel"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "github_profile", "talks_serp", "x_profile"], sites: ["linkedin.com", "medium.com", "github.com", "marketingjournal.cz"] },
  },
  {
    key: "event-marketing-manager",
    title: "Event Marketing Manager",
    family: "marketing",
    aliases: ["event manažer", "event manager", "event marketér", "manažer eventů", "event marketing", "event producer"],
    profile: "track-record",
    must_haves: [
      { id: "mh-events-delivered", title: "Events delivered", text: "Public pages show named events they organised or marketed", accepted_evidence: ["event page", "case study", "press"] },
      { id: "mh-event-scale", title: "Event scale shown", text: "Public figures on attendance, speakers or sponsors for their events", accepted_evidence: ["event page", "press", "case study"] },
      { id: "mh-event-employer", title: "Events role history", text: "Work history names an events or event marketing role", accepted_evidence: ["job history", "company page", "agency page"] },
      { id: "mh-event-recognition", title: "Event recognition", text: "Event work received an award or press coverage", accepted_evidence: ["award", "press", "ranking article"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "instagram_profile", "personal_site_crawl", "youtube_channel"], sites: ["linkedin.com", "eventbrite.com", "instagram.com", "marketingjournal.cz"] },
  },
  {
    key: "influencer-marketing-manager",
    title: "Influencer Marketing Manager",
    family: "marketing",
    aliases: ["influencer manažer", "influencer marketing specialista", "influencer manager", "influencer marketér", "creator partnerships manager", "specialista influencer marketingu"],
    profile: "audience",
    must_haves: [
      { id: "mh-influencer-campaigns", title: "Influencer campaigns", text: "Public campaigns with named creators that credit them or their team", accepted_evidence: ["campaign", "case study", "channel"] },
      { id: "mh-influencer-role", title: "Influencer role history", text: "Work history names an influencer or creator partnership role", accepted_evidence: ["job history", "agency page", "profile"] },
      { id: "mh-influencer-results", title: "Campaign results shown", text: "Published case or talk with a measured campaign outcome", accepted_evidence: ["case study", "talk", "published article"] },
      { id: "mh-influencer-platforms", title: "Platform range", text: "Campaign work spans platforms such as Instagram, TikTok or YouTube", accepted_evidence: ["campaign", "channel", "case study"] },
    ],
    sources: { steps: ["linkedin_profile", "instagram_profile", "tiktok_profile", "youtube_channel", "talks_serp", "x_profile"], sites: ["instagram.com", "tiktok.com", "linkedin.com", "lovebrands.cz", "youtube.com"] },
  },
  {
    key: "video-producer",
    title: "Video Producer",
    family: "marketing",
    aliases: ["videotvůrce", "video content creator", "video marketér", "videoproducent", "youtuber", "video editor", "videoeditor", "video střihač", "střihač videa"],
    profile: "audience",
    must_haves: [
      { id: "mh-public-video-work", title: "Public video work", text: "Has public videos or a channel with published marketing or brand content", accepted_evidence: ["channel", "showreel", "Vimeo project"] },
      { id: "mh-video-brands", title: "Brand video clients", text: "Videos or credits name brands or clients they produced for", accepted_evidence: ["portfolio", "credits", "case study"] },
      { id: "mh-production-range", title: "Production range", text: "Work shows more than one format, e.g. short-form, explainer or interview", accepted_evidence: ["channel", "showreel", "portfolio"] },
      { id: "mh-video-recognition", title: "Video recognition", text: "Has a festival selection, award or platform feature for video work", accepted_evidence: ["award", "press", "Vimeo staff pick"] },
    ],
    sources: { steps: ["youtube_channel", "instagram_profile", "tiktok_profile", "personal_site_crawl", "linkedin_profile", "x_profile"], sites: ["youtube.com", "vimeo.com", "tiktok.com", "instagram.com", "linkedin.com"] },
  },
  {
    key: "pricing-specialist",
    title: "Pricing Specialist",
    family: "marketing",
    aliases: ["pricing analyst", "pricing manager", "cenový analytik", "cenová analytička", "specialista pricingu", "pricing specialista", "specialista cenotvorby", "revenue management analyst", "cenotvorba"],
    profile: "makers",
    must_haves: [
      { id: "mh-pricing-role-history", title: "Pricing role history", text: "Held a named pricing, revenue management or category pricing role at a verifiable company", accepted_evidence: ["job history", "company page", "profile"] },
      { id: "mh-pricing-analysis-published", title: "Published pricing analysis", text: "Has a public case study, article or talk on a pricing change, price test or elasticity analysis", accepted_evidence: ["case study", "published article", "talk"] },
      { id: "mh-pricing-tooling", title: "Pricing tooling and data", text: "Public profile or work names the tools used, e.g. SQL, Excel, Power BI, a repricing or price-monitoring platform", accepted_evidence: ["profile", "certification", "case study"] },
      { id: "mh-pricing-results", title: "Measured pricing results", text: "Public example ties a pricing decision to a measured margin, conversion or revenue outcome", accepted_evidence: ["case study", "talk", "published article"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "github_profile", "x_profile"], sites: ["linkedin.com", "medium.com", "marketingjournal.cz", "ecommercebridge.cz"] },
  },
];
