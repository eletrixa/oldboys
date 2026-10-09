/**
 * Role catalog, product family: product, project and delivery roles with must-haves and an evidence plan.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/product.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `PRODUCT`: preselected roles of family "product", aliases in English and Czech
 *
 * Design constraints:
 * - Relative imports only; must-haves are observable from public web evidence, never Art. 9 or personality traits
 */
import type { RoleTemplate } from "./types";

export const PRODUCT: RoleTemplate[] = [
  {
    key: "product-manager",
    title: "Product Manager",
    family: "product",
    aliases: ["produktový manažer", "produktová manažerka", "pm", "product lead", "manažer produktu", "produktový manažer/manažerka", "produktový manažer/ka"],
    profile: "track-record",
    must_haves: [
      { id: "mh-shipped", title: "Products shipped", text: "Has shipped named products or features, visible in launches, press or release notes", accepted_evidence: ["product launch", "press", "case study", "job history"] },
      { id: "mh-outcomes", title: "Measured outcomes", text: "Cites metrics or business results of products owned", accepted_evidence: ["case study", "talk", "blog post", "interview"] },
      { id: "mh-discovery", title: "Discovery practice", text: "Describes customer research, experiments or prioritisation methods", accepted_evidence: ["blog post", "talk", "podcast"] },
      { id: "mh-community", title: "Product community presence", text: "Writes or speaks in product communities", accepted_evidence: ["talk", "blog post", "conference listing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"], sites: ["mindtheproduct.com", "producthunt.com", "medium.com", "substack.com"] },
  },
  {
    key: "senior-product-manager",
    title: "Senior Product Manager",
    family: "product",
    aliases: ["senior pm", "group product manager", "gpm", "lead product manager", "principal product manager", "vedoucí produktový manažer"],
    profile: "track-record",
    must_haves: [
      { id: "mh-portfolio", title: "Multi-product ownership", text: "Has owned a product line or several products over multiple years", accepted_evidence: ["job history", "press", "case study"] },
      { id: "mh-mentoring", title: "Leads other PMs", text: "Has managed or mentored product managers, shown in profiles or talks", accepted_evidence: ["job history", "talk", "interview"] },
      { id: "mh-results", title: "Revenue or growth results", text: "Cites revenue, retention or growth results from products led", accepted_evidence: ["case study", "talk", "interview", "press"] },
      { id: "mh-strategy", title: "Product strategy writing", text: "Has published product strategy or roadmap thinking", accepted_evidence: ["blog post", "talk", "podcast"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "youtube_channel", "personal_site_crawl", "x_profile"], sites: ["mindtheproduct.com", "medium.com", "substack.com", "speakerdeck.com"] },
  },
  {
    key: "head-of-product",
    title: "Head of Product",
    family: "product",
    aliases: ["vedoucí produktu", "cpo", "chief product officer", "product director", "vp of product", "produktový ředitel"],
    profile: "track-record",
    must_haves: [
      { id: "mh-org", title: "Product org leadership", text: "Has led a product organisation, shown in job history or interviews", accepted_evidence: ["job history", "interview", "press"] },
      { id: "mh-company-impact", title: "Company-level results", text: "Has product results tied to company growth, funding or exit", accepted_evidence: ["press", "interview", "case study"] },
      { id: "mh-thought", title: "Public product voice", text: "Speaks or writes publicly on product leadership", accepted_evidence: ["talk", "podcast", "blog post", "conference listing"] },
      { id: "mh-launches", title: "Launches under leadership", text: "Can be tied to named product launches at scale", accepted_evidence: ["product launch", "press", "job history"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "youtube_channel", "x_profile", "personal_site_crawl"], sites: ["mindtheproduct.com", "linkedin.com", "substack.com", "crunchbase.com", "youtube.com"] },
  },
  {
    key: "technical-product-manager",
    title: "Technical Product Manager",
    family: "product",
    aliases: ["technický produktový manažer", "tpm", "platform product manager", "api product manager", "product manager platformy"],
    profile: "track-record",
    must_haves: [
      { id: "mh-platform", title: "Platform or API product", text: "Has managed a developer-facing, API or platform product", accepted_evidence: ["product launch", "job history", "case study", "documentation"] },
      { id: "mh-technical", title: "Engineering background", text: "Shows engineering experience, code or technical writing", accepted_evidence: ["repo", "blog post", "job history", "certification listing"] },
      { id: "mh-adoption", title: "Developer adoption", text: "Cites adoption or usage of a technical product", accepted_evidence: ["case study", "talk", "press"] },
      { id: "mh-talks", title: "Technical talks", text: "Has spoken about architecture or developer products", accepted_evidence: ["talk", "conference listing", "podcast"] },
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["github.com", "mindtheproduct.com", "medium.com", "dev.to"] },
  },
  {
    key: "product-owner",
    title: "Product Owner",
    family: "product",
    aliases: ["vlastník produktu", "agile product owner", "produkt owner", "business owner"],
    profile: "track-record",
    must_haves: [
      { id: "mh-backlog", title: "Backlog ownership", text: "Has owned a product backlog for a named product or team", accepted_evidence: ["job history", "case study", "portfolio"] },
      { id: "mh-certification", title: "Scrum credential", text: "Holds a product owner credential (PSPO, CSPO, SAFe POPM)", accepted_evidence: ["certification listing", "registry entry"] },
      { id: "mh-delivery", title: "Delivered releases", text: "Can be tied to released features or products with named outcomes", accepted_evidence: ["product launch", "case study", "job history"] },
      { id: "mh-agile", title: "Agile community", text: "Writes or speaks about agile product practice", accepted_evidence: ["blog post", "talk", "conference listing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["scrum.org", "scrumalliance.org", "linkedin.com", "medium.com"] },
  },
  {
    key: "growth-product-manager",
    title: "Growth Product Manager",
    family: "product",
    aliases: ["growth pm", "produktový manažer growth", "pm pro růst"],
    profile: "track-record",
    must_haves: [
      { id: "mh-experiments", title: "Experiment program", text: "Has run growth experiments with reported lifts or learnings", accepted_evidence: ["case study", "blog post", "talk"] },
      { id: "mh-funnel", title: "Funnel metrics", text: "Cites activation, retention or conversion results from products led", accepted_evidence: ["case study", "talk", "interview"] },
      { id: "mh-tools", title: "Analytics and testing tools", text: "Uses product analytics and A/B tools (Amplitude, Mixpanel, Optimizely)", accepted_evidence: ["job history", "certification listing", "blog post"] },
      { id: "mh-community", title: "Growth community presence", text: "Writes or speaks in growth communities", accepted_evidence: ["talk", "blog post", "podcast", "conference listing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"], sites: ["reforge.com", "growthhackers.com", "medium.com", "substack.com"] },
  },
  {
    key: "product-marketing-manager",
    title: "Product Marketing Manager",
    family: "product",
    aliases: ["produktový marketingový manažer", "pmm", "product marketer", "product marketing lead", "manažer produktového marketingu"],
    profile: "track-record",
    must_haves: [
      { id: "mh-launches", title: "Launches led", text: "Has led named product launches, visible in press, launch pages or posts", accepted_evidence: ["product launch", "press", "case study"] },
      { id: "mh-positioning", title: "Positioning work", text: "Shows positioning, messaging or competitive analysis work", accepted_evidence: ["case study", "blog post", "portfolio"] },
      { id: "mh-content", title: "Published content", text: "Has published product-led content or enablement material", accepted_evidence: ["blog post", "talk", "portfolio"] },
      { id: "mh-community", title: "Marketing community", text: "Speaks or writes in product marketing communities", accepted_evidence: ["talk", "podcast", "conference listing"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "x_profile", "youtube_channel"], sites: ["producthunt.com", "pmalliance.com", "medium.com", "substack.com"] },
  },
  {
    key: "scrum-master",
    title: "Scrum Master",
    family: "product",
    aliases: ["scrum master / agile coach", "agilní kouč", "agile coach", "scrum mistr", "agilní trenér"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-certification", title: "Scrum certification", text: "Holds a Scrum or agile credential (PSM, CSM, SAFe, ICAgile)", accepted_evidence: ["certification listing", "registry entry"] },
      { id: "mh-teams", title: "Teams coached", text: "Has coached named teams or organisations through agile adoption", accepted_evidence: ["job history", "case study", "testimonial"] },
      { id: "mh-facilitation", title: "Public facilitation", text: "Has given agile talks, workshops or training", accepted_evidence: ["talk", "conference listing", "training listing"] },
      { id: "mh-writing", title: "Agile writing", text: "Writes about agile practice in blogs or community posts", accepted_evidence: ["blog post", "community post"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel"], sites: ["scrum.org", "scrumalliance.org", "agilealliance.org", "sessionize.com"] },
  },
  {
    key: "project-manager",
    title: "Project Manager",
    family: "product",
    aliases: ["projektový manažer", "projektová manažerka", "pjm", "it project manager", "řízení projektů"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-certification", title: "PM certification", text: "Holds a project credential (PMP, PRINCE2, IPMA)", accepted_evidence: ["certification listing", "registry entry"] },
      { id: "mh-delivered", title: "Projects delivered", text: "Has delivered named projects with scope, budget or team size stated", accepted_evidence: ["job history", "case study", "press"] },
      { id: "mh-domain", title: "Industry domain", text: "Shows multi-year project work in a specific industry", accepted_evidence: ["job history", "talk", "blog post"] },
      { id: "mh-tooling", title: "Tools and methods", text: "Uses documented methods and tools (Jira, MS Project, hybrid delivery)", accepted_evidence: ["job history", "certification listing", "blog post"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel"], sites: ["pmi.org", "ipma.world", "linkedin.com", "medium.com"] },
  },
  {
    key: "program-manager",
    title: "Program Manager",
    family: "product",
    aliases: ["programový manažer", "technical program manager", "pgm", "programme manager", "řízení programů"],
    profile: "track-record",
    must_haves: [
      { id: "mh-programs", title: "Multi-project programs", text: "Has run programs spanning several teams or projects, with named scope", accepted_evidence: ["job history", "case study", "talk"] },
      { id: "mh-stakeholders", title: "Executive reporting", text: "Shows cross-functional or executive-level program delivery", accepted_evidence: ["job history", "interview", "case study"] },
      { id: "mh-certification", title: "Program credential", text: "Holds a program credential (PgMP, MSP, SAFe RTE)", accepted_evidence: ["certification listing", "registry entry"] },
      { id: "mh-technical", title: "Technical program depth", text: "Shows engineering or infrastructure programs delivered", accepted_evidence: ["job history", "talk", "blog post"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel", "x_profile"], sites: ["pmi.org", "linkedin.com", "medium.com", "sessionize.com"] },
  },
  {
    key: "delivery-manager",
    title: "Delivery Manager",
    family: "product",
    aliases: ["manažer dodávek", "it delivery manager", "delivery lead", "engagement manager", "vedoucí delivery"],
    profile: "track-record",
    must_haves: [
      { id: "mh-delivery", title: "Delivery track record", text: "Has delivered software projects or releases for named clients or products", accepted_evidence: ["job history", "case study", "press"] },
      { id: "mh-teams", title: "Team leadership", text: "Has led delivery teams, with sizes or vendors named", accepted_evidence: ["job history", "interview", "talk"] },
      { id: "mh-practices", title: "Delivery practices", text: "Describes agile, DevOps or release practices used", accepted_evidence: ["blog post", "talk", "certification listing"] },
      { id: "mh-clients", title: "Client or vendor management", text: "Shows client-facing or outsourcing delivery management", accepted_evidence: ["job history", "case study", "testimonial"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel"], sites: ["linkedin.com", "scrumalliance.org", "pmi.org", "medium.com"] },
  },
  {
    key: "product-analyst",
    title: "Product Analyst",
    family: "product",
    aliases: ["produktový analytik", "product data analyst", "analytik produktu", "growth analyst", "product insights analyst"],
    profile: "makers",
    must_haves: [
      { id: "mh-sql", title: "SQL and analytics", text: "Shows SQL and Python or R analysis of product usage data", accepted_evidence: ["repo", "notebook", "case study", "job history"] },
      { id: "mh-tools", title: "Product analytics tools", text: "Has used Amplitude, Mixpanel, GA4 or similar in documented work", accepted_evidence: ["job history", "certification listing", "blog post"] },
      { id: "mh-experiments", title: "Experiment analysis", text: "Has analysed A/B tests with reported results", accepted_evidence: ["case study", "blog post", "talk"] },
      { id: "mh-insights", title: "Insights delivered", text: "Describes analyses that changed a product decision", accepted_evidence: ["case study", "blog post", "talk"] },
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "personal_site_crawl", "talks_serp"], sites: ["medium.com", "github.com", "kaggle.com", "mindtheproduct.com"] },
  },
];
