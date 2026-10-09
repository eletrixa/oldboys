/**
 * People and HR role templates for the role catalog.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/people.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - Static role templates of family "people": aliases, evidence profile, observable must-haves, evidence plan
 *
 * Design constraints:
 * - Must-haves are observable from public web evidence; never health, politics, religion, ethnicity, sexuality,
 *   age, family, personality, culture fit or trustworthiness (GDPR Art. 9, brief hard rules)
 */
import type { RoleTemplate } from "./types";

export const PEOPLE: RoleTemplate[] = [
  {
    key: "recruiter-talent-acquisition-partner",
    title: "Recruiter / Talent Acquisition Partner",
    family: "people",
    aliases: ["recruiter", "náborář", "recruiterka", "talent acquisition partner", "ta partner", "ta", "náborový specialista", "personalista náborář"],
    profile: "track-record",
    must_haves: [
      { id: "mh-hiring-track-record", title: "Hiring track record", text: "Held recruiter or TA roles at named companies with stated roles filled", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-role-coverage", title: "Role coverage", text: "Names the functions or seniority levels recruited for", accepted_evidence: ["job history", "conference bio"] },
      { id: "mh-sourcing-tools", title: "Sourcing tools", text: "Names ATS and sourcing tools used (Greenhouse, Teamio, LinkedIn Recruiter)", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-recruiting-presence", title: "Recruiting presence", text: "Public talks, posts or community activity on hiring practice", accepted_evidence: ["conference bio", "publication", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["linkedin.com", "jobs.cz", "prace.cz", "medium.com"] },
  },
  {
    key: "tech-recruiter",
    title: "Tech Recruiter",
    family: "people",
    aliases: ["it recruiter", "technical recruiter", "it náborář", "technický recruiter", "engineering recruiter", "it personalista"],
    profile: "track-record",
    must_haves: [
      { id: "mh-tech-hiring", title: "Tech hiring record", text: "Recruited engineers or IT specialists at named companies or agencies", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-tech-literacy", title: "Technical literacy", text: "Names stacks or engineering roles covered in a profile or post", accepted_evidence: ["job history", "publication"] },
      { id: "mh-community-presence", title: "Tech community presence", text: "Speaks at or organises tech meetups, job fairs or hackathons", accepted_evidence: ["conference bio", "press mention"] },
      { id: "mh-recruiting-tools", title: "Recruiting tooling", text: "Names ATS and sourcing tools used (Greenhouse, Lever, LinkedIn Recruiter)", accepted_evidence: ["job history", "certification listing"] },
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["linkedin.com", "meetup.com", "jobs.cz", "startupjobs.cz"] },
  },
  {
    key: "head-of-talent-recruiting-lead",
    title: "Head of Talent / Recruiting Lead",
    family: "people",
    aliases: ["head of talent acquisition", "head of recruiting", "vedoucí náboru", "recruiting manager", "ředitel náboru", "talent lead", "ta lead"],
    profile: "track-record",
    must_haves: [
      { id: "mh-recruiting-leadership", title: "Recruiting leadership", text: "Led a recruiting or talent team at a named company", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-scale-hiring", title: "Scale of hiring", text: "Public figures on headcount growth or hires made under their lead", accepted_evidence: ["press mention", "conference bio", "job history"] },
      { id: "mh-process-building", title: "Process building", text: "Describes building recruiting process, ATS rollout or hiring programs", accepted_evidence: ["publication", "conference bio", "job history"] },
      { id: "mh-talent-thought-leader", title: "Talent thought leadership", text: "Talks, podcasts or articles on hiring strategy", accepted_evidence: ["conference bio", "publication", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel", "x_profile"], sites: ["linkedin.com", "hrnews.cz", "medium.com", "e15.cz"] },
  },
  {
    key: "hr-business-partner",
    title: "HR Business Partner",
    family: "people",
    aliases: ["hrbp", "hr partner", "personální business partner", "business partner pro lidské zdroje", "hr konzultant"],
    profile: "track-record",
    must_haves: [
      { id: "mh-hrbp-role", title: "HRBP role", text: "Held HR business partner roles at named companies", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-business-units", title: "Business units supported", text: "Names the functions or business units supported", accepted_evidence: ["job history", "conference bio"] },
      { id: "mh-org-change", title: "Org change work", text: "Describes reorganisation, restructuring or change programs delivered", accepted_evidence: ["job history", "publication", "conference bio"] },
      { id: "mh-hr-qualification", title: "HR qualification", text: "Lists CIPD, SHRM, or a degree in HR or psychology of work", accepted_evidence: ["certification listing", "job history"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl"], sites: ["linkedin.com", "cipd.org", "shrm.org", "hrnews.cz"] },
  },
  {
    key: "hr-generalist",
    title: "HR Generalist",
    family: "people",
    aliases: ["hr specialist", "personalista", "personální specialista", "hr manager", "hr administrator", "specialista lidských zdrojů"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-hr-experience", title: "HR experience", text: "Stated HR generalist work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-labour-law", title: "Labour law knowledge", text: "Lists training in the Czech Labour Code or employment administration", accepted_evidence: ["certification listing", "job history"] },
      { id: "mh-hr-systems", title: "HR systems", text: "Names HR information systems used (SAP SuccessFactors, Personio, Workday)", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-hr-education", title: "HR education", text: "Lists an HR-related degree or course", accepted_evidence: ["certification listing", "job history"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "jobs.cz", "prace.cz"] },
  },
  {
    key: "head-of-people-chro",
    title: "Head of People / CHRO",
    family: "people",
    aliases: ["chro", "chief people officer", "hr director", "personální ředitel", "ředitel lidských zdrojů", "vp people", "head of hr"],
    profile: "track-record",
    must_haves: [
      { id: "mh-people-executive", title: "People executive role", text: "Held CHRO, HR director or head-of-people title at a named company", accepted_evidence: ["job history", "company filing", "press mention"] },
      { id: "mh-headcount-scale", title: "Headcount scale", text: "Employers' public headcount growth during the stated tenure", accepted_evidence: ["company filing", "press mention"] },
      { id: "mh-leadership-team", title: "Leadership team seat", text: "Listed on a company leadership page or in the commercial register", accepted_evidence: ["ARES/justice.cz record", "company filing", "job history"] },
      { id: "mh-people-strategy-voice", title: "People strategy voice", text: "Interviews, talks or articles on people strategy", accepted_evidence: ["conference bio", "press mention", "publication"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel", "x_profile"], sites: ["linkedin.com", "justice.cz", "hrnews.cz", "forbes.cz", "hn.cz"] },
  },
  {
    key: "people-operations-specialist",
    title: "People Operations Specialist",
    family: "people",
    aliases: ["people ops", "people operations", "hr operations specialist", "hr operations", "specialista people operations"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-peopleops-experience", title: "People ops experience", text: "Stated people operations or HR operations work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-hris-tools", title: "HRIS tools", text: "Names HRIS and workflow tools used (Personio, BambooHR, Workday, Notion)", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-onboarding-processes", title: "Onboarding processes", text: "Describes onboarding, offboarding or contract administration owned", accepted_evidence: ["job history", "publication"] },
      { id: "mh-ops-qualification", title: "Relevant qualification", text: "Lists an HR-related degree or certification", accepted_evidence: ["certification listing", "job history"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "jobs.cz", "startupjobs.cz"] },
  },
  {
    key: "learning-development-manager",
    title: "Learning and Development Manager",
    family: "people",
    aliases: ["l&d manager", "l&d", "learning and development", "vedoucí vzdělávání", "manažer vzdělávání a rozvoje", "training manager", "talent development manager"],
    profile: "track-record",
    must_haves: [
      { id: "mh-ld-role", title: "L&D role", text: "Held learning, training or development roles at named companies", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-programs-delivered", title: "Programs delivered", text: "Names leadership, onboarding or academy programs designed or run", accepted_evidence: ["job history", "publication", "conference bio"] },
      { id: "mh-ld-credentials", title: "L&D credentials", text: "Holds a listed ATD, CIPD or certified facilitator qualification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-training-presence", title: "Training presence", text: "Public talks, workshops or published material on learning", accepted_evidence: ["conference bio", "publication", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel"], sites: ["linkedin.com", "td.org", "cipd.org", "hrnews.cz", "medium.com"] },
  },
  {
    key: "compensation-benefits-specialist",
    title: "Compensation and Benefits Specialist",
    family: "people",
    aliases: ["c&b specialist", "c&b", "comp and ben", "specialista odměňování", "odměňování a benefity", "compensation analyst", "benefits specialist"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-cb-experience", title: "C&B experience", text: "Stated compensation or benefits work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-salary-benchmarking", title: "Salary benchmarking", text: "Names salary surveys or benchmarking tools used (Mercer, Korn Ferry, Aon)", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-cb-certification", title: "C&B certification", text: "Holds a listed WorldatWork, CCP or equivalent certification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-pay-transparency", title: "Pay structures", text: "Describes grading, bonus or equity plan design work", accepted_evidence: ["job history", "publication", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "worldatwork.org", "hrnews.cz", "jobs.cz"] },
  },
  {
    key: "employer-branding-specialist",
    title: "Employer Branding Specialist",
    family: "people",
    aliases: ["employer branding manager", "employer brand", "specialista employer brandingu", "hr marketing", "talent marketing", "recruitment marketing"],
    profile: "audience",
    must_haves: [
      { id: "mh-employer-brand-role", title: "Employer brand role", text: "Held employer branding or recruitment marketing roles at named companies", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-campaigns-delivered", title: "Campaigns delivered", text: "Public employer-brand campaigns, careers sites or videos credited to them", accepted_evidence: ["press mention", "publication", "job history"] },
      { id: "mh-brand-awards", title: "Awards and rankings", text: "Named in employer-brand awards or rankings (Zlatý Zaměstnavatel, Great Place to Work)", accepted_evidence: ["press mention", "certification listing"] },
      { id: "mh-social-audience", title: "Content and audience", text: "Runs public social channels or newsletters on work and careers", accepted_evidence: ["publication", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "instagram_profile", "youtube_channel", "x_profile", "talks_serp", "personal_site_crawl"], sites: ["linkedin.com", "instagram.com", "youtube.com", "hrnews.cz", "marketingovenoviny.cz"] },
  },
  {
    key: "hr-analyst",
    title: "HR Analyst",
    family: "people",
    aliases: ["people analyst", "people analytics", "hr analytik", "analytik lidských zdrojů", "hr data analyst", "workforce analyst"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-hr-analytics-experience", title: "HR analytics experience", text: "Stated HR or people analytics work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-analytics-tools", title: "Analytics tools", text: "Names SQL, Excel, Power BI, Tableau or Python used for HR data", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-metrics-ownership", title: "HR metrics", text: "Describes attrition, headcount or engagement reporting owned", accepted_evidence: ["job history", "publication", "conference bio"] },
      { id: "mh-analytics-training", title: "Analytics training", text: "Lists a people analytics or data course or relevant degree", accepted_evidence: ["certification listing", "job history"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "github_profile"], sites: ["linkedin.com", "medium.com", "hrnews.cz", "jobs.cz"] },
  },
];
