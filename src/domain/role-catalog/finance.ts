/**
 * Finance role templates for the role catalog.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/finance.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - Static role templates of family "finance": aliases, evidence profile, observable must-haves, evidence plan
 *
 * Design constraints:
 * - Must-haves are observable from public web evidence; never health, politics, religion, ethnicity, sexuality,
 *   age, family, personality, culture fit or trustworthiness (GDPR Art. 9, brief hard rules)
 */
import type { RoleTemplate } from "./types";

export const FINANCE: RoleTemplate[] = [
  {
    key: "accountant",
    title: "Accountant",
    family: "finance",
    aliases: ["účetní", "senior accountant", "general ledger accountant", "bookkeeper", "účetní auditor", "ap clerk", "accounts payable clerk", "accounts payable specialist", "accounts payable accountant", "accounts payable", "ap specialist", "ap accountant", "accounts receivable", "accounts receivable specialist", "ar specialist", "ar accountant", "fakturant", "fakturantka", "fakturant/ka", "účetní závazků", "účetní pohledávek", "junior accountant", "samostatná účetní", "samostatný účetní", "účetní/ho", "účetní/ka", "finanční účetní", "financial accountant"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-accounting-experience", title: "Accounting experience", text: "Stated hands-on bookkeeping or general-ledger work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-standards-knowledge", title: "Reporting standards", text: "Names Czech accounting standards, IFRS or US GAAP in a profile or certification", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-accounting-tools", title: "Accounting software", text: "Names accounting systems used (Pohoda, Money, SAP, Helios, Navision)", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-qualification", title: "Formal qualification", text: "Lists a finance or accounting degree or a recognised accounting certification", accepted_evidence: ["certification listing", "job history"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "justice.cz", "jobs.cz"] },
  },
  {
    key: "chief-accountant",
    title: "Chief Accountant",
    family: "finance",
    aliases: ["hlavní účetní", "head of accounting", "accounting manager", "vedoucí účtárny"],
    profile: "track-record",
    must_haves: [
      { id: "mh-accounting-lead", title: "Led accounting team", text: "Held a lead or manager accounting role at a named company", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-closing-reporting", title: "Closing and reporting", text: "Describes ownership of month-end close, statutory accounts or group reporting", accepted_evidence: ["job history", "conference bio"] },
      { id: "mh-ifrs-cz-gaap", title: "IFRS and Czech GAAP", text: "Names IFRS and Czech accounting standards experience in a profile or bio", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-company-scale", title: "Company scale", text: "Employers' size verifiable in public filings (revenue, headcount)", accepted_evidence: ["ARES/justice.cz record", "company filing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl"], sites: ["linkedin.com", "justice.cz", "kacr.cz", "ares.gov.cz"] },
  },
  {
    key: "financial-controller",
    title: "Financial Controller",
    family: "finance",
    aliases: ["finanční kontrolér", "kontrolér", "controller", "finance controller", "group controller", "kontroling"],
    profile: "track-record",
    must_haves: [
      { id: "mh-controlling-role", title: "Controlling role", text: "Held a controller or finance-control role at a named company", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-budget-forecast", title: "Budgeting and forecasting", text: "Describes budgeting, forecasting or variance reporting ownership", accepted_evidence: ["job history", "conference bio"] },
      { id: "mh-professional-cert", title: "Professional certification", text: "Holds a listed ACCA, CIMA, CFA or similar finance qualification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-erp-reporting", title: "ERP and BI tools", text: "Names ERP or reporting tools used (SAP, Oracle, Power BI, Hyperion)", accepted_evidence: ["job history", "certification listing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl"], sites: ["linkedin.com", "acca.global", "cimaglobal.com", "justice.cz"] },
  },
  {
    key: "cfo-head-of-finance",
    title: "CFO / Head of Finance",
    family: "finance",
    aliases: ["cfo", "finanční ředitel", "chief financial officer", "head of finance", "vedoucí financí", "finance director"],
    profile: "track-record",
    must_haves: [
      { id: "mh-executive-finance", title: "Executive finance role", text: "Held CFO, finance director or head-of-finance title at a named company", accepted_evidence: ["job history", "company filing", "press mention"] },
      { id: "mh-funding-events", title: "Funding or M&A", text: "Named in a funding round, acquisition, IPO or debt deal coverage", accepted_evidence: ["press mention", "company filing"] },
      { id: "mh-board-roles", title: "Board and statutory roles", text: "Listed as board member or statutory body member in the commercial register", accepted_evidence: ["ARES/justice.cz record", "company filing"] },
      { id: "mh-company-outcomes", title: "Company outcomes", text: "Employers' public revenue or growth figures during the stated tenure", accepted_evidence: ["company filing", "press mention"] },
      { id: "mh-thought-leadership", title: "Public finance voice", text: "Interviews, conference talks or articles on finance topics", accepted_evidence: ["conference bio", "press mention", "publication"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile", "youtube_channel"], sites: ["linkedin.com", "justice.cz", "forbes.cz", "hn.cz", "e15.cz"] },
  },
  {
    key: "fpa-analyst",
    title: "FP&A Analyst",
    family: "finance",
    aliases: ["fp&a", "fpa analyst", "finanční plánování a analýza", "financial planning analyst", "finanční analytik plánování"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-planning-experience", title: "Planning experience", text: "Stated budgeting, forecasting or financial modelling work at named employers", accepted_evidence: ["job history", "conference bio"] },
      { id: "mh-modelling-tools", title: "Modelling tools", text: "Names Excel modelling, planning or BI tools (Anaplan, Power BI, SAP BPC)", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-finance-qualification", title: "Finance qualification", text: "Lists a finance degree or CFA, ACCA or CIMA progress", accepted_evidence: ["certification listing", "job history"] },
      { id: "mh-business-partnering", title: "Business partnering", text: "Describes supporting a named business unit with analysis", accepted_evidence: ["job history", "publication"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "cfainstitute.org", "acca.global", "medium.com"] },
  },
  {
    key: "financial-analyst",
    title: "Financial Analyst",
    family: "finance",
    aliases: ["finanční analytik", "finance analyst", "business finance analyst", "analytik financí", "junior financial analyst"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-analysis-experience", title: "Analysis experience", text: "Stated financial analysis or reporting work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-valuation-modelling", title: "Modelling skills", text: "Names valuation, DCF or financial modelling work or training", accepted_evidence: ["certification listing", "publication", "job history"] },
      { id: "mh-cfa-progress", title: "CFA or equivalent", text: "Listed in a CFA, ACCA or similar candidate or charterholder directory", accepted_evidence: ["register entry", "certification listing"] },
      { id: "mh-published-analysis", title: "Published analysis", text: "Public write-ups, notes or articles showing analytical work", accepted_evidence: ["publication", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "x_profile"], sites: ["linkedin.com", "cfainstitute.org", "medium.com", "substack.com"] },
  },
  {
    key: "auditor",
    title: "Auditor",
    family: "finance",
    aliases: ["auditor účetní závěrky", "statutární auditor", "external auditor", "internal auditor", "interní auditor", "audit manager"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-auditor-register", title: "Auditor register entry", text: "Listed in the Chamber of Auditors of the Czech Republic (KAČR) register", accepted_evidence: ["register entry", "job history"] },
      { id: "mh-audit-employer", title: "Audit firm history", text: "Worked at a named audit firm or internal audit function", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-audit-qualification", title: "Audit qualification", text: "Holds a listed ACCA, CIA, CISA or equivalent certification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-audit-sector", title: "Sector experience", text: "Names industries or client types audited in a bio or profile", accepted_evidence: ["job history", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl"], sites: ["kacr.cz", "linkedin.com", "acca.global", "theiia.org", "justice.cz"] },
  },
  {
    key: "tax-advisor",
    title: "Tax Advisor",
    family: "finance",
    aliases: ["daňový poradce", "tax consultant", "tax manager", "daňový specialista", "daňový konzultant", "tax specialist"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-kdp-register", title: "KDP ČR register entry", text: "Listed in the Czech Chamber of Tax Advisors register (KDP ČR)", accepted_evidence: ["register entry", "job history"] },
      { id: "mh-tax-practice", title: "Tax practice history", text: "Worked at a named tax advisory firm or in-house tax function", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-tax-specialty", title: "Tax specialty", text: "Names a specialty such as VAT, transfer pricing or international tax", accepted_evidence: ["publication", "conference bio", "job history"] },
      { id: "mh-tax-publications", title: "Tax publications", text: "Authored articles, commentaries or conference talks on tax law", accepted_evidence: ["publication", "conference bio", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["kdpcr.cz", "linkedin.com", "hn.cz", "e15.cz", "justice.cz"] },
  },
  {
    key: "payroll-specialist",
    title: "Payroll Specialist",
    family: "finance",
    aliases: ["mzdová účetní", "mzdový účetní", "mzdy a personalistika", "payroll accountant", "payroll administrator", "mzdový specialista", "mzdový/á účetní", "mzdová/ý účetní", "mzdová účetní/personalistka", "personalistka/mzdová účetní"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-payroll-experience", title: "Payroll experience", text: "Stated payroll processing work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-payroll-software", title: "Payroll software", text: "Names payroll systems used (Mzdy Pohoda, Helios, SAP HR, ADP)", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-labour-law-knowledge", title: "Czech payroll rules", text: "Lists training or courses in Czech payroll, social and health insurance law", accepted_evidence: ["certification listing", "job history"] },
      { id: "mh-team-scale", title: "Payroll scale", text: "States number of employees or entities processed in a role", accepted_evidence: ["job history", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "jobs.cz", "justice.cz"] },
  },
  {
    key: "treasury-manager",
    title: "Treasury Manager",
    family: "finance",
    aliases: ["treasurer", "manažer treasury", "treasury analyst", "head of treasury", "finanční manažer treasury"],
    profile: "track-record",
    must_haves: [
      { id: "mh-treasury-role", title: "Treasury role", text: "Held a treasury or cash-management role at a named company", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-fx-liquidity", title: "FX and liquidity", text: "Describes FX hedging, liquidity or cash-pooling responsibility", accepted_evidence: ["job history", "conference bio", "publication"] },
      { id: "mh-treasury-cert", title: "Treasury certification", text: "Holds a listed ACT, CTP or equivalent treasury qualification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-bank-relations", title: "Bank relationships", text: "Named in financing, credit-facility or bond transaction coverage", accepted_evidence: ["press mention", "company filing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl"], sites: ["linkedin.com", "treasurers.org", "justice.cz", "e15.cz"] },
  },
  {
    key: "investment-analyst-vc-associate",
    title: "Investment Analyst / VC Associate",
    family: "finance",
    aliases: ["investiční analytik", "vc associate", "venture capital associate", "investment associate", "investment analyst", "private equity analyst"],
    profile: "track-record",
    must_haves: [
      { id: "mh-fund-affiliation", title: "Fund affiliation", text: "Listed on a fund or investment firm team page or in its portfolio news", accepted_evidence: ["job history", "press mention", "company filing"] },
      { id: "mh-deal-involvement", title: "Deal involvement", text: "Named in coverage of investments, rounds or exits", accepted_evidence: ["press mention", "company filing"] },
      { id: "mh-published-theses", title: "Published theses", text: "Public investment memos, newsletters, posts or podcasts on sectors", accepted_evidence: ["publication", "conference bio"] },
      { id: "mh-investment-credential", title: "Investment credential", text: "Holds a listed CFA or similar investment qualification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-founder-network", title: "Ecosystem presence", text: "Appears in startup ecosystem events, panels or founder interviews", accepted_evidence: ["conference bio", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "x_profile", "talks_serp", "personal_site_crawl", "youtube_channel"], sites: ["linkedin.com", "crunchbase.com", "cfainstitute.org", "substack.com", "forbes.cz"] },
  },
  {
    key: "credit-risk-analyst",
    title: "Credit Risk Analyst",
    family: "finance",
    aliases: ["analytik úvěrového rizika", "risk analyst", "credit analyst", "úvěrový analytik", "riziko analytik", "credit risk manager"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-risk-experience", title: "Credit risk experience", text: "Stated credit risk or underwriting work at a named bank or lender", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-risk-methods", title: "Risk methods", text: "Names scoring, IFRS 9, Basel or stress-testing work in a profile", accepted_evidence: ["job history", "publication", "conference bio"] },
      { id: "mh-risk-certification", title: "Risk certification", text: "Holds a listed FRM, PRM or equivalent risk certification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-risk-tools", title: "Analytics tools", text: "Names SQL, SAS, Python or R used for risk modelling", accepted_evidence: ["job history", "certification listing"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "garp.org", "cnb.cz", "jobs.cz"] },
  },
];
