/**
 * Role templates for executives, legal, consulting, research, media, education, built environment and healthcare.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/other.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - Static role templates of family "other": aliases, evidence profile, observable must-haves, evidence plan
 *
 * Design constraints:
 * - Must-haves are observable from public web evidence; never health, politics, religion, ethnicity, sexuality,
 *   age, family, personality, culture fit or trustworthiness (GDPR Art. 9, brief hard rules)
 * - Physician, pharmacist and nurse templates check registers and publications only, never patient or health data
 */
import type { RoleTemplate } from "./types";

export const OTHER: RoleTemplate[] = [
  {
    key: "ceo-managing-director",
    title: "CEO / Managing Director",
    family: "other",
    aliases: ["ceo", "chief executive officer", "generální ředitel", "jednatel", "výkonný ředitel", "managing director", "md"],
    profile: "track-record",
    must_haves: [
      { id: "mh-statutory-role", title: "Statutory role", text: "Listed as executive or statutory body member in the commercial register", accepted_evidence: ["ARES/justice.cz record", "company filing"] },
      { id: "mh-company-results", title: "Company results", text: "Employers' public revenue or growth figures during the stated tenure", accepted_evidence: ["company filing", "press mention"] },
      { id: "mh-leadership-history", title: "Leadership history", text: "Prior executive or general-management roles at named companies", accepted_evidence: ["job history", "press mention"] },
      { id: "mh-public-record", title: "Public record", text: "Interviews, conference keynotes or press coverage in their own name", accepted_evidence: ["press mention", "conference bio"] },
      { id: "mh-other-directorships", title: "Other directorships", text: "Other companies where they hold or held a role in the register", accepted_evidence: ["ARES/justice.cz record", "company filing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel", "x_profile"], sites: ["justice.cz", "linkedin.com", "forbes.cz", "hn.cz", "e15.cz"] },
  },
  {
    key: "founder-co-founder",
    title: "Founder / Co-founder",
    family: "other",
    aliases: ["founder", "co-founder", "zakladatel", "spoluzakladatel", "startup founder", "cofounder", "zakladatel firmy"],
    profile: "track-record",
    must_haves: [
      { id: "mh-founded-company", title: "Founded company", text: "Named founder of a company in the register or a company page", accepted_evidence: ["ARES/justice.cz record", "company filing", "press mention"] },
      { id: "mh-funding-raised", title: "Funding raised", text: "Funding rounds or grants attributed to their company in public listings", accepted_evidence: ["press mention", "company filing"] },
      { id: "mh-company-traction", title: "Company traction", text: "Public evidence of product launch, customers, revenue or headcount", accepted_evidence: ["company filing", "press mention"] },
      { id: "mh-exit-or-wind-down", title: "Exits and closures", text: "Outcomes of prior ventures verifiable in the register or news", accepted_evidence: ["ARES/justice.cz record", "press mention"] },
      { id: "mh-founder-voice", title: "Public founder voice", text: "Talks, interviews, posts or podcasts about their company", accepted_evidence: ["conference bio", "press mention", "publication"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"], sites: ["crunchbase.com", "justice.cz", "linkedin.com", "forbes.cz", "startupjobs.cz"] },
  },
  {
    key: "general-counsel-in-house-lawyer",
    title: "General Counsel / In-house Lawyer",
    family: "other",
    aliases: ["general counsel", "in-house lawyer", "in-house counsel", "právník", "podnikový právník", "hlavní právník", "head of legal", "gc"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-bar-register", title: "Bar register entry", text: "Listed in the Czech Bar Association (ČAK) register or a foreign bar directory", accepted_evidence: ["register entry", "court decision"] },
      { id: "mh-legal-employers", title: "Legal career", text: "Worked at named law firms or in-house legal teams", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-practice-areas", title: "Practice areas", text: "Names practice areas such as corporate, IP or commercial contracts", accepted_evidence: ["job history", "publication", "conference bio"] },
      { id: "mh-legal-publications", title: "Legal publications", text: "Authored legal commentary, articles or conference talks", accepted_evidence: ["publication", "conference bio", "press mention"] },
      { id: "mh-court-record", title: "Court appearances", text: "Named as counsel in published court decisions", accepted_evidence: ["court decision", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["cak.cz", "linkedin.com", "justice.cz", "epravo.cz", "chambers.com"] },
  },
  {
    key: "legal-counsel-junior",
    title: "Legal Counsel (Junior)",
    family: "other",
    aliases: ["junior legal counsel", "junior lawyer", "koncipient", "advokátní koncipient", "právník koncipient", "legal associate", "právní asistent"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-trainee-register", title: "Trainee register entry", text: "Listed as a trainee (koncipient) or lawyer in the ČAK register", accepted_evidence: ["register entry", "job history"] },
      { id: "mh-law-degree", title: "Law degree", text: "Lists a law degree from a named faculty", accepted_evidence: ["job history", "publication", "certification listing"] },
      { id: "mh-firm-experience", title: "Firm experience", text: "Worked or interned at a named law firm or legal department", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-student-legal-work", title: "Legal writing", text: "Moot court results, legal articles or thesis published online", accepted_evidence: ["publication", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["cak.cz", "linkedin.com", "epravo.cz", "prf.cuni.cz"] },
  },
  {
    key: "compliance-officer-dpo",
    title: "Compliance Officer / DPO",
    family: "other",
    aliases: ["compliance officer", "dpo", "data protection officer", "pověřenec pro ochranu osobních údajů", "compliance manager", "specialista compliance", "gdpr specialist"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-privacy-certification", title: "Privacy certification", text: "Holds a listed CIPP, CIPM, CIPT or ACAMS certification", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-compliance-career", title: "Compliance career", text: "Held compliance, privacy or DPO roles at named organisations", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-dpo-designation", title: "DPO designation", text: "Named as data protection officer in a company privacy notice", accepted_evidence: ["company filing", "press mention"] },
      { id: "mh-regulatory-knowledge", title: "Regulatory knowledge", text: "Publications or talks on GDPR, AML or sector regulation", accepted_evidence: ["publication", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["linkedin.com", "iapp.org", "uoou.cz", "epravo.cz"] },
  },
  {
    key: "management-consultant",
    title: "Management Consultant",
    family: "other",
    aliases: ["consultant", "konzultant", "manažerský konzultant", "strategy consultant", "business consultant", "senior consultant", "poradce"],
    profile: "track-record",
    must_haves: [
      { id: "mh-consulting-firm", title: "Consulting firm history", text: "Worked at a named consulting firm or ran an independent practice", accepted_evidence: ["job history", "company filing", "ARES/justice.cz record"] },
      { id: "mh-client-sectors", title: "Client sectors", text: "Names sectors or engagement types in a profile or case study", accepted_evidence: ["job history", "publication", "conference bio"] },
      { id: "mh-published-thinking", title: "Published thinking", text: "Articles, reports or books under their name", accepted_evidence: ["publication", "press mention"] },
      { id: "mh-conference-speaking", title: "Speaking record", text: "Speaker or panelist at named industry events", accepted_evidence: ["conference bio", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile", "youtube_channel"], sites: ["linkedin.com", "medium.com", "justice.cz", "forbes.cz"] },
  },
  {
    key: "strategy-manager",
    title: "Strategy Manager",
    family: "other",
    aliases: ["head of strategy", "manažer strategie", "corporate strategy manager", "strategický manažer", "strategy lead", "ředitel strategie"],
    profile: "track-record",
    must_haves: [
      { id: "mh-strategy-role", title: "Strategy role", text: "Held strategy or corporate development roles at named companies", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-strategic-initiatives", title: "Strategic initiatives", text: "Named in coverage of M&A, market entry or restructuring they led", accepted_evidence: ["press mention", "company filing"] },
      { id: "mh-consulting-background", title: "Analytical background", text: "Prior consulting, banking or analytics roles at named firms", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-strategy-publications", title: "Strategy publications", text: "Articles, talks or interviews on strategy topics", accepted_evidence: ["publication", "conference bio", "press mention"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["linkedin.com", "medium.com", "hn.cz", "e15.cz"] },
  },
  {
    key: "business-operations-analyst",
    title: "Business Operations Analyst (BizOps)",
    family: "other",
    aliases: ["bizops", "biz ops", "business operations", "operations analyst", "analytik business operations"],
    profile: "verify-only",
    must_haves: [
      { id: "mh-bizops-role", title: "BizOps role", text: "Stated business operations or chief-of-staff work at named employers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-analytics-stack", title: "Analytics stack", text: "Names SQL, spreadsheets, BI or automation tools used", accepted_evidence: ["job history", "certification listing"] },
      { id: "mh-cross-functional", title: "Cross-functional projects", text: "Describes named cross-team programs or process improvements delivered", accepted_evidence: ["job history", "publication", "conference bio"] },
      { id: "mh-bizops-writing", title: "Public writing", text: "Posts or talks on operating cadence, metrics or planning", accepted_evidence: ["publication", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "x_profile"], sites: ["linkedin.com", "medium.com", "substack.com", "startupjobs.cz"] },
  },
  {
    key: "market-researcher",
    title: "Customer Research / Market Researcher",
    family: "other",
    aliases: ["market researcher", "customer researcher", "výzkumník trhu", "tržní výzkumník", "ux researcher customer", "marketing researcher", "analytik trhu", "research manager"],
    profile: "makers",
    must_haves: [
      { id: "mh-research-employer", title: "Research employer", text: "Worked at a named research agency or in-house insights team", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-research-methods", title: "Research methods", text: "Names survey, interview or panel methods used in published work", accepted_evidence: ["publication", "job history", "conference bio"] },
      { id: "mh-published-studies", title: "Published studies", text: "Public reports, whitepapers or articles under their name", accepted_evidence: ["publication", "press mention"] },
      { id: "mh-research-membership", title: "Industry membership", text: "Listed in an industry body such as SIMAR or ESOMAR", accepted_evidence: ["register entry", "certification listing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "openalex_author", "x_profile"], sites: ["linkedin.com", "esomar.org", "simar.cz", "researchgate.net", "medium.com"] },
  },
  {
    key: "journalist-editor",
    title: "Journalist / Editor",
    family: "other",
    aliases: ["journalist", "editor", "novinář", "redaktor", "reportér", "šéfredaktor", "editor-in-chief", "publicista"],
    profile: "makers",
    must_haves: [
      { id: "mh-bylined-work", title: "Bylined work", text: "Articles published under their name in named outlets", accepted_evidence: ["publication", "press mention"] },
      { id: "mh-beat-coverage", title: "Beat coverage", text: "Consistent topic area visible across their published articles", accepted_evidence: ["publication", "press mention"] },
      { id: "mh-outlet-history", title: "Outlet history", text: "Staff or freelance roles at named media outlets", accepted_evidence: ["job history", "publication", "company filing"] },
      { id: "mh-journalism-awards", title: "Awards and recognition", text: "Named in journalism awards, nominations or fellowships", accepted_evidence: ["press mention", "conference bio"] },
      { id: "mh-correction-record", title: "Corrections record", text: "Public corrections, retractions or press council rulings on their work", accepted_evidence: ["publication", "court decision"] },
    ],
    sources: { steps: ["linkedin_profile", "x_profile", "talks_serp", "personal_site_crawl", "youtube_channel"], sites: ["linkedin.com", "seznamzpravy.cz", "hn.cz", "substack.com", "medium.com"] },
  },
  {
    key: "teacher-lecturer",
    title: "Teacher / Lecturer",
    family: "other",
    aliases: ["teacher", "lecturer", "učitel", "vyučující", "lektor", "odborný asistent", "pedagog", "university lecturer"],
    profile: "makers",
    must_haves: [
      { id: "mh-teaching-post", title: "Teaching post", text: "Listed as teacher or lecturer on a school or university staff page", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-subject-expertise", title: "Subject expertise", text: "Degree or publications in the subject taught", accepted_evidence: ["publication", "certification listing", "job history"] },
      { id: "mh-course-materials", title: "Course materials", text: "Public syllabi, lecture recordings, textbooks or course pages", accepted_evidence: ["publication", "conference bio"] },
      { id: "mh-teaching-qualification", title: "Teaching qualification", text: "Lists a teaching qualification or pedagogical certification", accepted_evidence: ["certification listing", "register entry"] },
    ],
    sources: { steps: ["linkedin_profile", "openalex_author", "orcid_search", "youtube_channel", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "scholar.google.com", "orcid.org", "researchgate.net", "youtube.com"] },
  },
  {
    key: "architect-buildings",
    title: "Architect (Buildings)",
    family: "other",
    aliases: ["architekt", "autorizovaný architekt", "licensed architect", "project architect", "architect", "architektka"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-cka-register", title: "ČKA register entry", text: "Listed in the Czech Chamber of Architects (ČKA) register as authorised architect", accepted_evidence: ["register entry", "press mention"] },
      { id: "mh-built-projects", title: "Built projects", text: "Completed buildings credited to them on studio sites or in architecture media", accepted_evidence: ["publication", "press mention"] },
      { id: "mh-studio-history", title: "Studio history", text: "Worked at or led a named architecture studio", accepted_evidence: ["job history", "ARES/justice.cz record", "company filing"] },
      { id: "mh-design-awards", title: "Design awards", text: "Named in architecture awards, competitions or exhibitions", accepted_evidence: ["press mention", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "instagram_profile", "talks_serp"], sites: ["cka.cz", "archiweb.cz", "linkedin.com", "behance.net", "justice.cz"] },
  },
  {
    key: "civil-engineer",
    title: "Civil Engineer",
    family: "other",
    aliases: ["stavební inženýr", "autorizovaný inženýr", "construction engineer", "structural engineer", "statik", "projektant staveb", "inženýr staveb"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-ckait-register", title: "ČKAIT register entry", text: "Listed in the Czech Chamber of Authorised Engineers (ČKAIT) register", accepted_evidence: ["register entry", "job history"] },
      { id: "mh-engineering-projects", title: "Engineering projects", text: "Named projects credited to them in company, client or press sources", accepted_evidence: ["publication", "press mention", "company filing"] },
      { id: "mh-engineering-employer", title: "Engineering employers", text: "Worked at named design or construction firms", accepted_evidence: ["job history", "ARES/justice.cz record"] },
      { id: "mh-engineering-specialty", title: "Specialty area", text: "States an authorisation field such as structures, transport or water", accepted_evidence: ["register entry", "job history"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "openalex_author"], sites: ["ckait.cz", "linkedin.com", "justice.cz", "researchgate.net"] },
  },
  {
    key: "physician",
    title: "Physician",
    family: "other",
    aliases: ["lékař", "doctor", "medical doctor", "md physician", "mudr", "primář", "medical advisor", "lékařka"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-medical-chamber", title: "ČLK register entry", text: "Listed in the Czech Medical Chamber (ČLK) register of physicians", accepted_evidence: ["register entry", "job history"] },
      { id: "mh-specialisation", title: "Medical specialisation", text: "Holds a listed specialisation or board certification", accepted_evidence: ["register entry", "certification listing"] },
      { id: "mh-clinical-affiliation", title: "Institutional affiliation", text: "Listed on a hospital, clinic or university staff page", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-medical-publications", title: "Medical publications", text: "Peer-reviewed papers or trial registry entries under their name", accepted_evidence: ["publication", "register entry"] },
      { id: "mh-sanctions-check", title: "Regulatory actions", text: "Public disciplinary or licence decisions in chamber or court records", accepted_evidence: ["register entry", "court decision"] },
    ],
    sources: { steps: ["orcid_search", "openalex_author", "linkedin_profile", "talks_serp", "personal_site_crawl"], sites: ["lkcr.cz", "pubmed.ncbi.nlm.nih.gov", "orcid.org", "linkedin.com", "researchgate.net"] },
  },
  {
    key: "pharmacist",
    title: "Pharmacist",
    family: "other",
    aliases: ["lékárník", "farmaceut", "klinický farmaceut", "pharmacy manager", "vedoucí lékárník", "lékárnice"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-pharmacy-chamber", title: "ČLnK register entry", text: "Listed in the Czech Chamber of Pharmacists (ČLnK) register", accepted_evidence: ["register entry", "job history"] },
      { id: "mh-pharmacy-qualification", title: "Pharmacy qualification", text: "Holds a listed pharmacy degree and specialist attestation", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-pharmacy-employer", title: "Pharmacy employers", text: "Worked at a named pharmacy, hospital or pharma company", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-pharmacy-publications", title: "Pharmacy publications", text: "Papers, articles or talks on pharmacy practice", accepted_evidence: ["publication", "conference bio"] },
    ],
    sources: { steps: ["linkedin_profile", "orcid_search", "openalex_author", "talks_serp", "personal_site_crawl"], sites: ["lekarnici.cz", "linkedin.com", "orcid.org", "pubmed.ncbi.nlm.nih.gov"] },
  },
  {
    key: "real-estate-agent",
    title: "Real Estate Agent",
    family: "other",
    aliases: ["realitní makléř", "makléř", "realitní poradce", "estate agent", "realtor", "real estate broker", "realitní maklér"],
    profile: "track-record",
    must_haves: [
      { id: "mh-trade-licence", title: "Trade licence", text: "Real-estate brokerage trade licence in the Czech Trade Licence Register", accepted_evidence: ["register entry", "ARES/justice.cz record"] },
      { id: "mh-agency-affiliation", title: "Agency affiliation", text: "Listed on a named agency's team page or portal profile", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-listings-record", title: "Listings record", text: "Active or past public listings attributed to them", accepted_evidence: ["press mention", "publication"] },
      { id: "mh-professional-membership", title: "Professional membership", text: "Member of a professional body such as ARK ČR", accepted_evidence: ["register entry", "certification listing"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "instagram_profile", "talks_serp"], sites: ["sreality.cz", "linkedin.com", "justice.cz", "ark.cz", "bezrealitky.cz"] },
  },
  {
    key: "nurse",
    title: "Nurse",
    family: "other",
    aliases: ["zdravotní sestra", "všeobecná sestra", "sestra", "registered nurse", "rn", "zdravotní bratr", "sestra specialistka"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-nurse-register", title: "Nursing register entry", text: "Listed in the Czech Chamber of Nurses (ČKS) or a national nursing register", accepted_evidence: ["register entry", "job history"] },
      { id: "mh-nursing-qualification", title: "Nursing qualification", text: "Holds a listed nursing degree, diploma or specialist certificate", accepted_evidence: ["certification listing", "register entry"] },
      { id: "mh-facility-history", title: "Facility history", text: "Worked at named hospitals, clinics or care providers", accepted_evidence: ["job history", "company filing"] },
      { id: "mh-nursing-specialty", title: "Nursing specialty", text: "States a care area such as ICU, paediatrics or surgery in a profile", accepted_evidence: ["job history", "certification listing"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["linkedin.com", "cnna.cz", "mzcr.cz", "jobs.cz"] },
  },
];
