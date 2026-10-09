/**
 * Role catalog templates for the operations family: operations leadership, support, supply chain, admin and quality.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/operations.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `OPERATIONS`: preselected operations roles with EN/CZ aliases, observable must-haves and an evidence plan
 *
 * Design constraints:
 * - Must-haves are answerable from public web evidence; verify-only roles check history, tenure and tools, not output
 * - Never health, politics, religion, ethnicity, sexuality, age, family, personality or trustworthiness
 */
import type { RoleTemplate } from "./types";

export const OPERATIONS: RoleTemplate[] = [
  {
    key: "operations-manager",
    title: "Operations Manager",
    family: "operations",
    aliases: ["ops manager", "manažer provozu", "provozní manažer", "vedoucí provozu", "business operations manager"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-ops-management",
        title: "Operations management",
        text: "Managed operations or a service function for 2+ years at named employers",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-process-improvement",
        title: "Process improvement",
        text: "Describes process improvement or automation projects, with employer named (post, talk, profile)",
        accepted_evidence: ["LinkedIn post", "conference bio", "case study"],
      },
      {
        id: "mh-lean-credentials",
        title: "Lean or Six Sigma training",
        text: "Lists Lean, Six Sigma or PMP credentials from a named body",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
      {
        id: "mh-team-scope",
        title: "Team and scope stated",
        text: "States team size, sites or budget managed in a profile or press",
        accepted_evidence: ["LinkedIn profile", "press mention", "company page"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "forbes.cz", "hn.cz", "podcasts.apple.com"],
    },
  },
  {
    key: "coo-head-of-operations",
    title: "Chief Operating Officer",
    family: "operations",
    aliases: ["coo", "head of operations", "director of operations", "provozní ředitel", "ředitel provozu", "vp operations"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-executive-ops-seat",
        title: "Executive operations seat",
        text: "Held a COO, VP or Head of Operations seat at a named company",
        accepted_evidence: ["job history", "company page", "press mention"],
      },
      {
        id: "mh-scaling-outcomes",
        title: "Scaling outcomes",
        text: "States headcount, revenue or footprint growth they ran operations through (profile, press, talk)",
        accepted_evidence: ["press mention", "podcast", "conference bio", "Crunchbase listing"],
      },
      {
        id: "mh-ops-thought-leadership",
        title: "Operations voice",
        text: "Speaks or writes publicly on operating models, scaling or organisation design",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post", "personal site"],
      },
      {
        id: "mh-funded-company",
        title: "Funded or listed employers",
        text: "Worked at venture-backed or listed companies with verifiable funding or filings",
        accepted_evidence: ["Crunchbase listing", "press mention", "company page"],
      },
    ],
    sources: {
      steps: ["talks_serp", "linkedin_profile", "youtube_channel", "x_profile", "personal_site_crawl"],
      sites: ["linkedin.com", "crunchbase.com", "forbes.cz", "hn.cz", "podcasts.apple.com"],
    },
  },
  {
    key: "customer-support-specialist",
    title: "Customer Support Specialist",
    family: "operations",
    aliases: ["customer service representative", "support agent", "zákaznická podpora", "specialista zákaznické podpory", "operátor zákaznického servisu", "support specialist"],
    profile: "verify-only",
    must_haves: [
      {
        id: "mh-support-history",
        title: "Support job history",
        text: "Held customer support roles at named employers with dates",
        accepted_evidence: ["job history", "LinkedIn profile", "LinkedIn recommendation"],
      },
      {
        id: "mh-support-tenure",
        title: "Tenure",
        text: "Has 2+ years in support, with no unexplained gaps in public job history",
        accepted_evidence: ["job history", "LinkedIn profile"],
      },
      {
        id: "mh-helpdesk-tools",
        title: "Helpdesk tools",
        text: "Names helpdesk tools used (Zendesk, Freshdesk, Intercom) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing", "personal site"],
      },
      {
        id: "mh-language-channels",
        title: "Languages and channels",
        text: "States support languages or channels (chat, phone, email) in a profile",
        accepted_evidence: ["LinkedIn profile", "personal site"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"],
      sites: ["linkedin.com", "zendesk.com", "intercom.com"],
    },
  },
  {
    key: "head-of-customer-support",
    title: "Head of Customer Support",
    family: "operations",
    aliases: ["customer support manager", "head of customer service", "support team lead", "vedoucí zákaznické podpory", "manažer zákaznického servisu", "director of support"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-support-leadership",
        title: "Support team leadership",
        text: "Led a named customer support team for 2+ years at identifiable employers",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-support-metrics",
        title: "Stated support outcomes",
        text: "States CSAT, response time or ticket volume outcomes publicly (profile, talk, case study)",
        accepted_evidence: ["case study", "podcast", "conference bio", "LinkedIn post"],
      },
      {
        id: "mh-support-stack",
        title: "Support stack built",
        text: "Names helpdesk or support tooling they rolled out (Zendesk, Intercom, Freshdesk)",
        accepted_evidence: ["LinkedIn post", "case study", "LinkedIn profile"],
      },
      {
        id: "mh-support-community",
        title: "Support community presence",
        text: "Speaks or writes in support or CX communities and events",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"],
      sites: ["linkedin.com", "zendesk.com", "intercom.com", "podcasts.apple.com"],
    },
  },
  {
    key: "supply-chain-manager",
    title: "Supply Chain Manager",
    family: "operations",
    aliases: ["scm", "supply chain specialist", "manažer dodavatelského řetězce", "specialista supply chain", "supply chain planner", "vedoucí supply chain"],
    profile: "credentialed",
    must_haves: [
      {
        id: "mh-supply-chain-history",
        title: "Supply chain roles",
        text: "Held supply chain, planning or sourcing roles at named employers for 3+ years",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-scm-certification",
        title: "Supply chain certification",
        text: "Holds a verifiable APICS/ASCM credential (CSCP, CPIM) or equivalent",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
      {
        id: "mh-erp-planning",
        title: "ERP and planning systems",
        text: "Names ERP or planning systems used (SAP, Oracle, Kinaxis) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing", "case study"],
      },
      {
        id: "mh-scm-visibility",
        title: "Supply chain visibility",
        text: "Speaks or writes publicly on supply chain topics (talk, article, interview)",
        accepted_evidence: ["conference bio", "podcast", "press mention"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "ascm.org", "forbes.cz", "hn.cz"],
    },
  },
  {
    key: "logistics-coordinator",
    title: "Logistics Coordinator",
    family: "operations",
    aliases: ["logistics specialist", "logistik", "koordinátor logistiky", "specialista logistiky", "dispečer", "shipping coordinator"],
    profile: "verify-only",
    must_haves: [
      {
        id: "mh-logistics-history",
        title: "Logistics job history",
        text: "Held logistics, dispatch or shipping roles at named employers with dates",
        accepted_evidence: ["job history", "LinkedIn profile", "LinkedIn recommendation"],
      },
      {
        id: "mh-logistics-tenure",
        title: "Tenure",
        text: "Has 2+ years in logistics, with no unexplained gaps in public job history",
        accepted_evidence: ["job history", "LinkedIn profile"],
      },
      {
        id: "mh-logistics-tools",
        title: "Logistics systems",
        text: "Names TMS, WMS or ERP tools used (SAP, Transporeon) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing"],
      },
      {
        id: "mh-trade-training",
        title: "Trade or freight training",
        text: "Lists freight, customs or forwarding training from a named body",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"],
      sites: ["linkedin.com", "ascm.org", "transporeon.com"],
    },
  },
  {
    key: "procurement-manager",
    title: "Procurement Manager",
    family: "operations",
    aliases: ["purchasing manager", "nákupčí", "vedoucí nákupu", "manažer nákupu", "strategic sourcing manager", "head of procurement"],
    profile: "credentialed",
    must_haves: [
      {
        id: "mh-procurement-history",
        title: "Procurement roles",
        text: "Held procurement or sourcing roles at named employers for 3+ years",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-cips-credential",
        title: "Procurement credential",
        text: "Holds a verifiable CIPS, CPSM or equivalent procurement credential",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
      {
        id: "mh-spend-scope",
        title: "Spend or category scope",
        text: "States categories or spend managed in a profile, talk or press",
        accepted_evidence: ["LinkedIn profile", "conference bio", "press mention"],
      },
      {
        id: "mh-procurement-tools",
        title: "Procurement systems",
        text: "Names e-procurement or ERP tools used (SAP Ariba, Coupa) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing", "case study"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "cips.org", "ascm.org", "forbes.cz"],
    },
  },
  {
    key: "office-manager",
    title: "Office Manager",
    family: "operations",
    aliases: ["office administrator", "vedoucí kanceláře", "office koordinátor", "správce kanceláře", "administrativní manažer", "office coordinator"],
    profile: "verify-only",
    must_haves: [
      {
        id: "mh-office-history",
        title: "Office management history",
        text: "Held office management or administration roles at named employers with dates",
        accepted_evidence: ["job history", "LinkedIn profile", "LinkedIn recommendation"],
      },
      {
        id: "mh-office-tenure",
        title: "Tenure",
        text: "Has 2+ years in office or admin roles, with no unexplained gaps in public job history",
        accepted_evidence: ["job history", "LinkedIn profile"],
      },
      {
        id: "mh-office-tools",
        title: "Office tools",
        text: "Names tools used (Google Workspace, Microsoft 365, Slack, expense tools) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing", "personal site"],
      },
      {
        id: "mh-office-scope",
        title: "Scope stated",
        text: "States office size, vendors or events handled in a profile or reference",
        accepted_evidence: ["LinkedIn profile", "LinkedIn recommendation"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"],
      sites: ["linkedin.com", "jobs.cz", "prace.cz"],
    },
  },
  {
    key: "executive-assistant",
    title: "Executive Assistant",
    family: "operations",
    aliases: ["ea", "personal assistant", "asistentka", "asistent vedení", "asistentka managementu", "office assistant to ceo"],
    profile: "verify-only",
    must_haves: [
      {
        id: "mh-ea-history",
        title: "Executive support history",
        text: "Supported named executives or C-level teams at identifiable employers",
        accepted_evidence: ["job history", "LinkedIn profile", "LinkedIn recommendation"],
      },
      {
        id: "mh-ea-tenure",
        title: "Tenure",
        text: "Has 3+ years in assistant roles, with no unexplained gaps in public job history",
        accepted_evidence: ["job history", "LinkedIn profile"],
      },
      {
        id: "mh-ea-tools",
        title: "Productivity tools",
        text: "Names tools used (Google Workspace, Microsoft 365, calendar and travel tools) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing"],
      },
      {
        id: "mh-ea-languages",
        title: "Languages stated",
        text: "States working languages in a profile, with a language certificate if listed",
        accepted_evidence: ["LinkedIn profile", "certification listing"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"],
      sites: ["linkedin.com", "jobs.cz", "prace.cz"],
    },
  },
  {
    key: "chief-of-staff",
    title: "Chief of Staff",
    family: "operations",
    aliases: ["cos", "chief of staff to ceo", "šéf kabinetu", "vedoucí kanceláře ředitele", "strategy and operations lead", "business operations lead"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-cos-seat",
        title: "Chief of staff seat",
        text: "Held a Chief of Staff or strategy and operations role at a named company",
        accepted_evidence: ["job history", "company page", "press mention"],
      },
      {
        id: "mh-cross-functional",
        title: "Cross-functional programs",
        text: "Describes cross-functional programs, OKR or board processes they ran, employer named",
        accepted_evidence: ["LinkedIn post", "conference bio", "podcast", "case study"],
      },
      {
        id: "mh-prior-background",
        title: "Operator or consulting background",
        text: "Has a documented consulting, finance or operating background at named firms",
        accepted_evidence: ["job history", "LinkedIn profile", "company page"],
      },
      {
        id: "mh-cos-visibility",
        title: "Public writing or talks",
        text: "Writes or speaks publicly on operating cadence, strategy or scaling",
        accepted_evidence: ["conference bio", "podcast", "LinkedIn post", "personal site"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "bluesky_profile"],
      sites: ["linkedin.com", "crunchbase.com", "forbes.cz", "podcasts.apple.com"],
    },
  },
  {
    key: "project-coordinator",
    title: "Project Coordinator",
    family: "operations",
    aliases: ["project administrator", "project assistant", "koordinátor projektů", "projektový koordinátor", "projektový asistent", "pmo coordinator"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-project-history",
        title: "Project coordination history",
        text: "Coordinated named projects or programs at identifiable employers",
        accepted_evidence: ["job history", "LinkedIn recommendation", "company page"],
      },
      {
        id: "mh-pm-credential",
        title: "Project credential",
        text: "Holds a verifiable PMP, PRINCE2, CAPM or Agile certification",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
      {
        id: "mh-pm-tools",
        title: "Project tools",
        text: "Names project tools used (Jira, Asana, MS Project, Monday) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing", "personal site"],
      },
      {
        id: "mh-delivered-projects",
        title: "Delivered projects",
        text: "Linked to publicly visible delivered projects (launch, event, rollout)",
        accepted_evidence: ["case study", "press mention", "company page"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "pmi.org", "axelos.com"],
    },
  },
  {
    key: "quality-manager",
    title: "Quality Manager",
    family: "operations",
    aliases: ["qa manager iso", "manažer kvality", "vedoucí kvality", "iso auditor", "quality assurance manager", "quality systems manager"],
    profile: "credentialed",
    must_haves: [
      {
        id: "mh-iso-credential",
        title: "ISO auditor credential",
        text: "Holds a verifiable ISO 9001 lead auditor or equivalent certificate",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
      {
        id: "mh-quality-roles",
        title: "Quality roles",
        text: "Held quality management roles at named employers for 3+ years",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-certified-sites",
        title: "Certified systems led",
        text: "Linked to a named company's ISO certification or audit success (press, company page)",
        accepted_evidence: ["company page", "press mention", "certification listing"],
      },
      {
        id: "mh-quality-methods",
        title: "Quality methods",
        text: "Lists Six Sigma, Lean, 8D or IATF training from a named body",
        accepted_evidence: ["certification listing", "LinkedIn profile", "conference bio"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "iso.org", "asq.org", "forbes.cz"],
    },
  },
  {
    key: "facility-manager",
    title: "Facility Manager",
    family: "operations",
    aliases: ["facilities manager", "fm manager", "správce budov", "facility manažer", "vedoucí správy budov", "technický správce"],
    profile: "verify-only",
    must_haves: [
      {
        id: "mh-facility-history",
        title: "Facility management history",
        text: "Managed named buildings, sites or facility contracts with dates",
        accepted_evidence: ["job history", "LinkedIn profile", "company page"],
      },
      {
        id: "mh-facility-tenure",
        title: "Tenure",
        text: "Has 3+ years in facility roles, with no unexplained gaps in public job history",
        accepted_evidence: ["job history", "LinkedIn profile"],
      },
      {
        id: "mh-facility-credential",
        title: "Facility credentials",
        text: "Lists facility management training (IFMA FMP, NEBOSH, CAFM) from a named body",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
      {
        id: "mh-facility-tools",
        title: "Facility systems",
        text: "Names CAFM or building systems used in a profile",
        accepted_evidence: ["LinkedIn profile", "case study"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"],
      sites: ["linkedin.com", "ifma.org", "iso.org"],
    },
  },
  {
    key: "warehouse-manager",
    title: "Warehouse Manager",
    family: "operations",
    aliases: ["warehouse supervisor", "vedoucí skladu", "skladník vedoucí", "manažer skladu", "logistics warehouse lead", "fulfilment manager"],
    profile: "verify-only",
    must_haves: [
      {
        id: "mh-warehouse-history",
        title: "Warehouse management history",
        text: "Managed named warehouses or fulfilment sites with dates",
        accepted_evidence: ["job history", "LinkedIn profile", "company page"],
      },
      {
        id: "mh-warehouse-tenure",
        title: "Tenure",
        text: "Has 3+ years in warehouse leadership, with no unexplained gaps in public job history",
        accepted_evidence: ["job history", "LinkedIn profile"],
      },
      {
        id: "mh-wms-tools",
        title: "WMS tools",
        text: "Names WMS or ERP tools used (SAP EWM, Manhattan, Odoo) in a profile",
        accepted_evidence: ["LinkedIn profile", "certification listing"],
      },
      {
        id: "mh-warehouse-training",
        title: "Safety or equipment training",
        text: "Lists warehouse safety or equipment certificates from a named body",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"],
      sites: ["linkedin.com", "ascm.org", "jobs.cz"],
    },
  },
  {
    key: "implementation-specialist",
    title: "Implementation Specialist",
    family: "operations",
    aliases: ["onboarding specialist", "implementation manager", "implementation consultant", "specialista implementace", "onboarding manažer", "implementační konzultant"],
    profile: "track-record",
    must_haves: [
      {
        id: "mh-implementation-history",
        title: "Implementation roles",
        text: "Held implementation or onboarding roles at named software vendors for 2+ years",
        accepted_evidence: ["job history", "company page", "LinkedIn recommendation"],
      },
      {
        id: "mh-rollout-projects",
        title: "Customer rollouts",
        text: "Linked to named customer rollouts or go-lives (case study, press, post)",
        accepted_evidence: ["case study", "press mention", "LinkedIn post"],
      },
      {
        id: "mh-product-certification",
        title: "Product certification",
        text: "Lists platform certifications (Salesforce, SAP, HubSpot, NetSuite) from the vendor",
        accepted_evidence: ["certification listing", "LinkedIn profile"],
      },
      {
        id: "mh-training-content",
        title: "Training content",
        text: "Published onboarding guides, webinars or training talks under their name",
        accepted_evidence: ["conference bio", "YouTube demo", "personal site", "podcast"],
      },
    ],
    sources: {
      steps: ["linkedin_profile", "talks_serp", "youtube_channel", "personal_site_crawl", "x_profile"],
      sites: ["linkedin.com", "trailblazer.me", "hubspot.com", "youtube.com"],
    },
  },
];
