/**
 * Role catalog templates for the sales family: SDR to CRO, account, partner and customer roles.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/sales.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `SALES`: preselected sales roles with EN/CZ aliases, observable must-haves and an evidence plan
 *
 * Design constraints:
 * - Must-haves are answerable from public web evidence; quota or ARR outcomes only when stated publicly
 * - Never health, politics, religion, ethnicity, sexuality, age, family, personality or trustworthiness
 */
import type { RoleTemplate } from "./types";

export const SALES: RoleTemplate[] = [
  {
    key: "sales-development-representative",
    title: "Sales Development Representative",
    family: "sales",
    aliases: ["sdr", "bdr", "business development representative", "obchodní zástupce", "junior obchodník", "lead generation specialist"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-outbound-b2b",
        title: "Outbound B2B prospecting",
        text: "Held an SDR/BDR or outbound prospecting role at a named B2B company",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-sales-tooling",
        title: "Sales tooling",
        text: "Names sales tools used (Salesforce, HubSpot, Outreach, Apollo, Sales Navigator) in a profile or post",
        accepted_evidence: ["LinkedIn profile", "certification listing", "personal site"],
      },
      {
        id: "mh-progression",
        title: "Role progression",
        text: "Shows promotion or a move toward AE or team lead at the same or a later employer",
        accepted_evidence: ["job history", "LinkedIn post", "company announcement"],
      },
      {
        id: "mh-stated-results",
        title: "Publicly stated results",
        text: "States meetings booked or pipeline outcomes publicly (profile, post, talk)",
        accepted_evidence: ["LinkedIn profile", "LinkedIn post", "podcast"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl"],
      sites: ["linkedin.com", "trailblazer.me", "hubspot.com", "pavilion.com"],
    },
  },
  {
    key: "account-executive",
    title: "Account Executive",
    family: "sales",
    aliases: ["ae", "b2b sales executive", "sales executive", "obchodník", "obchodní manažer", "account exekutiv"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-closed-b2b-deals",
        title: "Closed B2B deals",
        text: "Has closed B2B SaaS deals as an AE for 2+ years (named employers)",
        accepted_evidence: ["job history", "LinkedIn recommendation", "case study", "press mention"],
      },
      {
        id: "mh-named-customers",
        title: "Named customers or segment",
        text: "Names customers, segment or deal size sold into (company page, case study, profile)",
        accepted_evidence: ["case study", "company page", "press mention"],
      },
      {
        id: "mh-quota-outcomes",
        title: "Stated sales outcomes",
        text: "States quota/ARR outcomes publicly (profile, talk)",
        accepted_evidence: ["LinkedIn profile", "podcast", "conference bio"],
      },
      {
        id: "mh-sales-method",
        title: "Sales methodology",
        text: "Cites a sales methodology or training (MEDDICC, Challenger, SPIN) in a profile or post",
        accepted_evidence: ["certification listing", "LinkedIn post", "personal site"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "youtube_channel", "personal_site_crawl"],
      sites: ["linkedin.com", "crunchbase.com", "g2.com", "trailblazer.me", "pavilion.com"],
    },
  },
  {
    key: "enterprise-account-executive",
    title: "Enterprise Account Executive",
    family: "sales",
    aliases: ["enterprise ae", "enterprise sales executive", "large account executive", "enterprise obchodník", "obchodní manažer pro velké zákazníky", "strategic account executive"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-enterprise-deals",
        title: "Enterprise deal history",
        text: "Sold to enterprise buyers (1,000+ employees) with named employers and customers",
        accepted_evidence: ["job history", "case study", "press mention", "company page"],
      },
      {
        id: "mh-complex-cycle",
        title: "Complex sales cycles",
        text: "Describes multi-stakeholder or long-cycle deals publicly (profile, talk, article)",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post"],
      },
      {
        id: "mh-tenure-quality",
        title: "Tenure at sellers",
        text: "Held 2+ years at an enterprise software or services vendor with a verifiable customer base",
        accepted_evidence: ["job history", "company page", "Crunchbase listing"],
      },
      {
        id: "mh-stated-outcomes",
        title: "Stated sales outcomes",
        text: "States quota/ARR outcomes publicly (profile, talk)",
        accepted_evidence: ["LinkedIn profile", "podcast", "award"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "youtube_channel", "x_profile", "personal_site_crawl"],
      sites: ["linkedin.com", "crunchbase.com", "g2.com", "forbes.cz", "hn.cz"],
    },
  },
  {
    key: "key-account-manager",
    title: "Key Account Manager",
    family: "sales",
    aliases: ["kam", "key account manažer", "manažer klíčových zákazníků", "strategic account manager", "national account manager", "správce klíčových účtů"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-key-accounts",
        title: "Key account ownership",
        text: "Managed named key or strategic accounts for 2+ years at identifiable employers",
        accepted_evidence: ["job history", "LinkedIn recommendation", "company page"],
      },
      {
        id: "mh-account-growth",
        title: "Account growth evidence",
        text: "Shows account expansion, renewals or contract wins (case study, press, profile)",
        accepted_evidence: ["case study", "press mention", "LinkedIn post"],
      },
      {
        id: "mh-sector-fit",
        title: "Sector experience",
        text: "Has worked in the hiring company's sector (retail, FMCG, B2B services) per job history",
        accepted_evidence: ["job history", "company page", "conference bio"],
      },
      {
        id: "mh-negotiation",
        title: "Negotiation credentials",
        text: "Lists negotiation or key account training from a named provider",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "crunchbase.com", "forbes.cz", "hn.cz"],
    },
  },
  {
    key: "sales-manager",
    title: "Sales Manager",
    family: "sales",
    aliases: ["head of sales", "sales team lead", "sales lead", "vedoucí obchodu", "vedoucí obchodního týmu", "manažer prodeje"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-team-leadership",
        title: "Sales team leadership",
        text: "Led a named sales team for 2+ years (employer and team size visible)",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-ic-background",
        title: "Individual sales background",
        text: "Has a documented IC sales role before management at named employers",
        accepted_evidence: ["job history", "LinkedIn profile"],
      },
      {
        id: "mh-team-results",
        title: "Stated team results",
        text: "States team quota/ARR outcomes publicly (profile, talk, press)",
        accepted_evidence: ["press mention", "podcast", "conference bio", "award"],
      },
      {
        id: "mh-hiring-coaching",
        title: "Hiring and coaching",
        text: "Shares public writing or talks on sales hiring, coaching or process",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post", "personal site"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "youtube_channel", "x_profile", "personal_site_crawl"],
      sites: ["linkedin.com", "pavilion.com", "forbes.cz", "hn.cz", "podcasts.apple.com"],
    },
  },
  {
    key: "vp-sales-cro",
    title: "VP Sales / Chief Revenue Officer",
    family: "sales",
    aliases: ["vp sales", "cro", "chief revenue officer", "vice president of sales", "obchodní ředitel", "ředitel prodeje", "head of revenue"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-revenue-leadership",
        title: "Revenue leadership",
        text: "Held a VP Sales, CRO or equivalent seat at a named company",
        accepted_evidence: ["job history", "company page", "press mention"],
      },
      {
        id: "mh-scale-outcomes",
        title: "Growth at scale",
        text: "States ARR or growth outcomes publicly with company and period (profile, talk, press)",
        accepted_evidence: ["press mention", "podcast", "conference bio", "Crunchbase listing"],
      },
      {
        id: "mh-gtm-thought",
        title: "Go-to-market voice",
        text: "Speaks or writes publicly on go-to-market, pricing or sales org design",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post", "personal site"],
      },
      {
        id: "mh-board-investors",
        title: "Investor-backed experience",
        text: "Worked at venture-backed or listed companies with verifiable funding or filings",
        accepted_evidence: ["Crunchbase listing", "press mention", "company page"],
      },
    ],
    sources: {
      steps: ["talks_serp", "linkedin_profile", "youtube_channel", "x_profile", "personal_site_crawl", "bluesky_profile"],
      sites: ["linkedin.com", "crunchbase.com", "saastr.com", "forbes.cz", "podcasts.apple.com"],
    },
  },
  {
    key: "business-development-manager",
    title: "Business Development Manager",
    family: "sales",
    aliases: ["bdm", "business development", "manažer obchodního rozvoje", "obchodní rozvoj", "new business manager", "growth partnerships lead"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-new-business",
        title: "New business wins",
        text: "Won new customers or markets in a named BD role (case study, press, profile)",
        accepted_evidence: ["job history", "case study", "press mention"],
      },
      {
        id: "mh-market-entry",
        title: "Market entry work",
        text: "Shows launching a product or region (e.g. CEE, DACH) at an identifiable employer",
        accepted_evidence: ["press mention", "company page", "LinkedIn post"],
      },
      {
        id: "mh-deal-structuring",
        title: "Deal structuring",
        text: "Names partnerships, contracts or joint ventures they negotiated, publicly announced",
        accepted_evidence: ["press mention", "company page", "case study"],
      },
      {
        id: "mh-network-visibility",
        title: "Industry visibility",
        text: "Appears on conference programs, panels or industry association pages",
        accepted_evidence: ["conference bio", "podcast", "company page"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"],
      sites: ["linkedin.com", "crunchbase.com", "czechcrunch.cz", "forbes.cz", "hn.cz"],
    },
  },
  {
    key: "partnerships-manager",
    title: "Partnerships Manager",
    family: "sales",
    aliases: ["partnership manager", "strategic partnerships manager", "alliances manager", "manažer partnerství", "partnerský manažer", "head of partnerships"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-partner-programs",
        title: "Partner programs run",
        text: "Built or ran a named partner, alliance or integration program",
        accepted_evidence: ["job history", "company page", "press mention"],
      },
      {
        id: "mh-announced-deals",
        title: "Announced partnerships",
        text: "Is linked to publicly announced partnerships with named companies",
        accepted_evidence: ["press mention", "company page", "LinkedIn post"],
      },
      {
        id: "mh-ecosystem-presence",
        title: "Ecosystem presence",
        text: "Speaks, writes or hosts content in partner ecosystems (marketplaces, communities)",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post"],
      },
      {
        id: "mh-partner-revenue",
        title: "Stated partner revenue",
        text: "States partner-sourced revenue or pipeline outcomes publicly (profile, talk)",
        accepted_evidence: ["LinkedIn profile", "podcast", "case study"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "youtube_channel", "personal_site_crawl"],
      sites: ["linkedin.com", "crunchbase.com", "hubspot.com", "salesforce.com", "czechcrunch.cz"],
    },
  },
  {
    key: "customer-success-manager",
    title: "Customer Success Manager",
    family: "sales",
    aliases: ["csm", "customer success", "manažer zákaznického úspěchu", "customer success specialist", "client success manager", "zákaznický úspěch"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-csm-tenure",
        title: "CSM tenure at SaaS",
        text: "Worked as CSM or similar for 2+ years at named SaaS or subscription companies",
        accepted_evidence: ["job history", "LinkedIn recommendation", "company page"],
      },
      {
        id: "mh-retention-outcomes",
        title: "Retention outcomes",
        text: "States retention, NRR or churn outcomes publicly (profile, talk, case study)",
        accepted_evidence: ["case study", "podcast", "conference bio", "LinkedIn post"],
      },
      {
        id: "mh-cs-tooling",
        title: "CS tooling",
        text: "Names CS platforms used (Gainsight, HubSpot, Totango, Intercom) in a profile or post",
        accepted_evidence: ["LinkedIn profile", "certification listing", "personal site"],
      },
      {
        id: "mh-cs-community",
        title: "CS community presence",
        text: "Speaks or writes in customer success communities or events",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"],
      sites: ["linkedin.com", "hubspot.com", "g2.com", "pavilion.com"],
    },
  },
  {
    key: "account-manager",
    title: "Account Manager",
    family: "sales",
    aliases: ["am", "client manager", "správce účtů", "account manažer", "klientský manažer", "obchodní zástupce pro stávající zákazníky"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-account-portfolio",
        title: "Account portfolio",
        text: "Managed a client portfolio at named employers for 2+ years",
        accepted_evidence: ["job history", "LinkedIn recommendation", "company page"],
      },
      {
        id: "mh-upsell-renewal",
        title: "Upsell and renewals",
        text: "Shows upsell, renewal or retention work (case study, recommendation, profile)",
        accepted_evidence: ["case study", "LinkedIn recommendation", "LinkedIn profile"],
      },
      {
        id: "mh-industry-fit",
        title: "Industry experience",
        text: "Has worked in the hiring company's industry or client type per job history",
        accepted_evidence: ["job history", "company page"],
      },
      {
        id: "mh-crm-tools",
        title: "CRM tools",
        text: "Names CRM tools or certifications (Salesforce, HubSpot, Pipedrive) in a profile",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "trailblazer.me", "hubspot.com", "g2.com"],
    },
  },
  {
    key: "sales-engineer",
    title: "Sales Engineer",
    family: "sales",
    aliases: ["pre-sales engineer", "presales engineer", "solutions engineer", "solution consultant", "předprodejní inženýr", "pre-sales konzultant", "technický obchodník"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-presales-tenure",
        title: "Pre-sales tenure",
        text: "Held a sales or solutions engineering role at a named technical vendor for 2+ years",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-technical-depth",
        title: "Technical depth",
        text: "Shows technical work in public (demos, repos, certifications) in the product domain",
        accepted_evidence: ["certification listing", "conference bio", "YouTube demo", "personal site"],
      },
      {
        id: "mh-demo-talks",
        title: "Demos and talks",
        text: "Gave public demos, webinars or conference talks on a product or solution",
        accepted_evidence: ["conference bio", "YouTube demo", "podcast"],
      },
      {
        id: "mh-deal-support",
        title: "Deal support outcomes",
        text: "Linked to named customer wins or proofs of concept (case study, press)",
        accepted_evidence: ["case study", "press mention", "LinkedIn post"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "youtube_channel", "github_profile", "personal_site_crawl"],
      sites: ["linkedin.com", "youtube.com", "trailblazer.me", "salesforce.com", "github.com"],
    },
  },
  {
    key: "revenue-operations",
    title: "Revenue Operations Manager",
    family: "sales",
    aliases: ["revops", "revenue operations", "sales operations manager", "sales ops", "manažer revenue operations", "obchodní operace"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-revops-tenure",
        title: "RevOps or sales ops tenure",
        text: "Held a RevOps or sales operations role for 2+ years at named employers",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-crm-admin",
        title: "CRM platform expertise",
        text: "Lists Salesforce or HubSpot admin/architect certifications or named CRM projects",
        accepted_evidence: ["certification listing", "LinkedIn profile", "trailblazer profile"],
      },
      {
        id: "mh-funnel-systems",
        title: "Funnel and forecasting systems",
        text: "Describes pipeline, forecasting or attribution systems built, with employer named",
        accepted_evidence: ["LinkedIn post", "conference bio", "case study", "personal site"],
      },
      {
        id: "mh-revops-community",
        title: "RevOps community presence",
        text: "Speaks or writes in RevOps or operations communities",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile", "youtube_channel"],
      sites: ["linkedin.com", "trailblazer.me", "hubspot.com", "salesforce.com", "pavilion.com"],
    },
  },
  {
    key: "channel-partner-sales-manager",
    title: "Channel Sales Manager",
    family: "sales",
    aliases: ["partner sales manager", "channel manager", "reseller manager", "manažer obchodních partnerů", "channel account manager", "manažer distribuce"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-channel-tenure",
        title: "Channel sales tenure",
        text: "Managed resellers, distributors or partners at named vendors for 2+ years",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-partner-recruitment",
        title: "Partner recruitment",
        text: "Recruited or enabled named channel partners (press release, partner page, post)",
        accepted_evidence: ["press mention", "company page", "LinkedIn post"],
      },
      {
        id: "mh-channel-region",
        title: "Regional channel coverage",
        text: "Covered a stated region (CEE, DACH, EMEA) in a channel role per job history",
        accepted_evidence: ["job history", "LinkedIn profile", "conference bio"],
      },
      {
        id: "mh-partner-programs-cert",
        title: "Partner program knowledge",
        text: "Cites partner program certifications or training from a named vendor",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl"],
      sites: ["linkedin.com", "crunchbase.com", "salesforce.com", "forbes.cz"],
    },
  },
  {
    key: "retail-store-manager",
    title: "Retail Store Manager",
    family: "sales",
    aliases: ["store manager", "shop manager", "vedoucí prodejny", "manažer prodejny", "vedoucí pobočky", "retail manager"],
    profile: "verify-only",
    must_haves: [
      {
        id: "mh-store-leadership",
        title: "Store management history",
        text: "Managed a store or branch of a named retail chain (job history, company page)",
        accepted_evidence: ["job history", "LinkedIn profile", "company page"],
      },
      {
        id: "mh-retail-tenure",
        title: "Retail tenure",
        text: "Has 3+ years of retail roles with named employers and dates",
        accepted_evidence: ["job history", "LinkedIn recommendation"],
      },
      {
        id: "mh-team-size",
        title: "Team size stated",
        text: "States team size or store scope in a profile or reference",
        accepted_evidence: ["LinkedIn profile", "LinkedIn recommendation"],
      },
      {
        id: "mh-retail-recognition",
        title: "Retail recognition",
        text: "Has a public award or mention for store performance from a named chain",
        accepted_evidence: ["award", "press mention", "company page"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl"],
      sites: ["linkedin.com", "forbes.cz", "hn.cz"],
    },
  },
];
