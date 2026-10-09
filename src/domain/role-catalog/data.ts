/**
 * Role catalog, data family: data, analytics, ML and AI roles with must-haves and an evidence plan.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/data.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `DATA`: preselected roles of family "data", aliases in English and Czech
 * - Code-heavy roles (data engineer, analytics engineer, data scientist, ML/MLOps/AI/NLP/CV engineer, research scientist)
 *   list `github_deep` right after `github_profile`; the 6-step cap drops the last entry of ML engineer, AI engineer and research scientist
 *
 * Design constraints:
 * - Relative imports only; must-haves are observable from public web evidence, never Art. 9 or personality traits
 */
import type { RoleTemplate } from "./types";

export const DATA: RoleTemplate[] = [
  {
    key: "data-engineer",
    title: "Data Engineer",
    family: "data",
    aliases: ["datový inženýr", "data engineering", "etl developer", "big data engineer", "data platform engineer"],
    profile: "makers",
    must_haves: [
      { id: "mh-pipelines", title: "Production data pipelines", text: "Has built production data pipelines (Airflow, dbt, Spark, Kafka)", accepted_evidence: ["repo", "job history", "blog post", "talk"] },
      { id: "mh-warehouse", title: "Warehouse and lakehouse", text: "Has worked with a cloud warehouse or lakehouse (Snowflake, BigQuery, Databricks)", accepted_evidence: ["job history", "certification listing", "repo"] },
      { id: "mh-sql-python", title: "SQL and Python", text: "Shows SQL and Python or Scala code in public repositories or answers", accepted_evidence: ["repo", "Stack Overflow answer", "blog post"] },
      { id: "mh-scale", title: "Scale and reliability", text: "Describes data volumes, SLAs or incident work on a production platform", accepted_evidence: ["talk", "blog post", "job history"] },
    ],
    sources: { steps: ["github_profile", "github_deep", "linkedin_profile", "stackexchange_profile", "talks_serp", "personal_site_crawl"], sites: ["github.com", "medium.com", "dev.to", "stackoverflow.com"] },
  },
  {
    key: "data-analyst",
    title: "Data Analyst",
    family: "data",
    aliases: ["datový analytik", "analytik dat", "reporting analyst", "insights analyst"],
    profile: "makers",
    must_haves: [
      { id: "mh-sql", title: "SQL analysis", text: "Shows SQL-based analysis work, public queries or case studies", accepted_evidence: ["repo", "notebook", "case study", "job history"] },
      { id: "mh-dashboards", title: "Dashboards and reporting", text: "Has published dashboards or reports (Tableau, Power BI, Looker)", accepted_evidence: ["public gallery", "portfolio", "job history"] },
      { id: "mh-stats", title: "Statistics and Python", text: "Uses Python or R for statistical analysis in public notebooks", accepted_evidence: ["notebook", "repo", "blog post"] },
      { id: "mh-stories", title: "Business insight stories", text: "Has written up analyses that led to a business decision", accepted_evidence: ["case study", "blog post", "talk"] },
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "personal_site_crawl", "talks_serp"], sites: ["public.tableau.com", "kaggle.com", "github.com", "medium.com"] },
  },
  {
    key: "bi-developer",
    title: "BI Developer",
    family: "data",
    aliases: ["bi vývojář", "bi analytik", "business intelligence developer", "reporting developer", "power bi developer"],
    profile: "makers",
    must_haves: [
      { id: "mh-bi-tools", title: "BI platform delivery", text: "Has delivered reports in Power BI, Tableau, Qlik or Looker", accepted_evidence: ["public gallery", "job history", "certification listing"] },
      { id: "mh-modeling", title: "Dimensional modeling", text: "Shows data modeling work (star schema, semantic layer, DAX)", accepted_evidence: ["blog post", "repo", "talk"] },
      { id: "mh-sql", title: "Advanced SQL", text: "Writes advanced SQL or T-SQL against a warehouse", accepted_evidence: ["repo", "Stack Overflow answer", "job history"] },
      { id: "mh-community", title: "Community contribution", text: "Contributes to BI community content (forum answers, templates, talks)", accepted_evidence: ["forum answer", "talk", "blog post"] },
    ],
    sources: { steps: ["linkedin_profile", "stackexchange_profile", "github_profile", "talks_serp", "personal_site_crawl"], sites: ["community.fabric.microsoft.com", "public.tableau.com", "github.com", "medium.com"] },
  },
  {
    key: "analytics-engineer",
    title: "Analytics Engineer",
    family: "data",
    aliases: ["analytický inženýr", "dbt developer", "dbt engineer", "analytics developer"],
    profile: "makers",
    must_haves: [
      { id: "mh-dbt", title: "dbt modeling", text: "Has built and tested dbt or SQL transformation layers", accepted_evidence: ["repo", "blog post", "job history"] },
      { id: "mh-semantic", title: "Metrics and semantic layer", text: "Defines shared metrics or a semantic layer for self-serve analytics", accepted_evidence: ["blog post", "talk", "case study"] },
      { id: "mh-quality", title: "Data testing practice", text: "Shows data tests, CI or documentation practice in public code", accepted_evidence: ["repo", "blog post"] },
      { id: "mh-warehouse", title: "Cloud warehouse", text: "Has worked on Snowflake, BigQuery or Redshift in production", accepted_evidence: ["job history", "certification listing"] },
    ],
    sources: { steps: ["github_profile", "github_deep", "linkedin_profile", "talks_serp", "stackexchange_profile", "personal_site_crawl"], sites: ["github.com", "getdbt.com", "medium.com", "substack.com"] },
  },
  {
    key: "data-scientist",
    title: "Data Scientist",
    family: "data",
    aliases: ["datový vědec", "datová vědkyně", "data science specialist", "applied scientist"],
    profile: "makers",
    must_haves: [
      { id: "mh-modeling", title: "Applied modeling", text: "Has built predictive or statistical models shown in public notebooks or papers", accepted_evidence: ["notebook", "repo", "paper", "blog post"] },
      { id: "mh-experiments", title: "Experimentation", text: "Describes A/B tests or causal analysis with measured results", accepted_evidence: ["case study", "blog post", "talk"] },
      { id: "mh-production", title: "Models in production", text: "Has shipped a model that a product or business process uses", accepted_evidence: ["job history", "talk", "case study"] },
      { id: "mh-community", title: "Competitions and open work", text: "Has ranked in competitions or published open datasets and code", accepted_evidence: ["competition ranking", "repo", "dataset listing"] },
    ],
    sources: { steps: ["github_profile", "github_deep", "openalex_author", "huggingface_profile", "linkedin_profile", "talks_serp"], sites: ["kaggle.com", "github.com", "scholar.google.com", "medium.com"] },
  },
  {
    key: "machine-learning-engineer",
    title: "Machine Learning Engineer",
    family: "data",
    aliases: ["ml inženýr", "inženýr strojového učení", "ml engineer", "mle", "machine learning developer"],
    profile: "makers",
    must_haves: [
      { id: "mh-training", title: "Model training code", text: "Has public code for training or fine-tuning models (PyTorch, TensorFlow, JAX)", accepted_evidence: ["repo", "model card", "notebook"] },
      { id: "mh-serving", title: "Model serving", text: "Has deployed models behind an API or batch job in production", accepted_evidence: ["job history", "repo", "talk", "blog post"] },
      { id: "mh-opensource", title: "Open-source ML work", text: "Contributes to open-source ML libraries or released models", accepted_evidence: ["repo", "pull request", "model card"] },
      { id: "mh-eval", title: "Evaluation rigor", text: "Documents evaluation, benchmarks or ablations for models built", accepted_evidence: ["paper", "blog post", "model card"] },
    ],
    sources: { steps: ["github_profile", "github_deep", "huggingface_profile", "openalex_author", "linkedin_profile", "talks_serp"], sites: ["github.com", "huggingface.co", "kaggle.com", "paperswithcode.com", "arxiv.org"] },
  },
  {
    key: "mlops-engineer",
    title: "MLOps Engineer",
    family: "data",
    aliases: ["mlops inženýr", "ml platform engineer", "ml infrastructure engineer", "machine learning operations engineer"],
    profile: "makers",
    must_haves: [
      { id: "mh-pipelines", title: "ML pipelines", text: "Has built training or deployment pipelines (Kubeflow, MLflow, SageMaker, Vertex)", accepted_evidence: ["repo", "job history", "blog post"] },
      { id: "mh-infra", title: "Infrastructure as code", text: "Shows Docker, Kubernetes or Terraform work for ML workloads", accepted_evidence: ["repo", "job history", "certification listing"] },
      { id: "mh-monitoring", title: "Model monitoring", text: "Describes monitoring, drift detection or model registry practice", accepted_evidence: ["talk", "blog post", "repo"] },
      { id: "mh-ci", title: "CI/CD for models", text: "Has automated testing and release of models in CI/CD", accepted_evidence: ["repo", "talk", "job history"] },
    ],
    sources: { steps: ["github_profile", "github_deep", "linkedin_profile", "talks_serp", "stackexchange_profile", "personal_site_crawl"], sites: ["github.com", "mlops.community", "medium.com", "huggingface.co"] },
  },
  {
    key: "ai-engineer",
    title: "AI Engineer",
    family: "data",
    aliases: ["llm engineer", "ai inženýr", "generative ai engineer", "ai developer", "llm vývojář", "prompt engineer", "ai software engineer", "ai software developer", "ai vývojář"],
    profile: "makers",
    must_haves: [
      { id: "mh-llm-apps", title: "LLM applications", text: "Has shipped an LLM-based product or agent, public demo or repo", accepted_evidence: ["repo", "product launch", "demo", "blog post"] },
      { id: "mh-rag", title: "RAG and retrieval", text: "Shows retrieval, embeddings or vector search work", accepted_evidence: ["repo", "blog post", "talk"] },
      { id: "mh-evals", title: "Evals and guardrails", text: "Documents evaluation, testing or guardrails for LLM output", accepted_evidence: ["repo", "blog post", "talk"] },
      { id: "mh-opensource", title: "Open-source AI work", text: "Contributes to open-source AI tooling or published models", accepted_evidence: ["repo", "pull request", "model card"] },
    ],
    sources: { steps: ["github_profile", "github_deep", "huggingface_profile", "x_profile", "linkedin_profile", "talks_serp"], sites: ["github.com", "huggingface.co", "arxiv.org", "substack.com", "producthunt.com"] },
  },
  {
    key: "research-scientist-ml",
    title: "Research Scientist (ML)",
    family: "data",
    aliases: ["vědecký pracovník ml", "ml researcher", "machine learning researcher", "ai research scientist", "výzkumník strojového učení"],
    profile: "makers",
    must_haves: [
      { id: "mh-papers", title: "Peer-reviewed publications", text: "Has first-author papers at ML venues (NeurIPS, ICML, ICLR, ACL, CVPR)", accepted_evidence: ["paper", "conference listing", "google scholar profile"] },
      { id: "mh-citations", title: "Citation impact", text: "Has work cited by others, visible in OpenAlex or Google Scholar", accepted_evidence: ["google scholar profile", "openalex record"] },
      { id: "mh-code", title: "Reproducible code", text: "Releases code, models or datasets alongside papers", accepted_evidence: ["repo", "model card", "dataset listing"] },
      { id: "mh-affiliation", title: "Research affiliation", text: "Has a documented lab, university or industry research affiliation", accepted_evidence: ["institution page", "orcid record", "paper"] },
    ],
    sources: { steps: ["openalex_author", "orcid_search", "github_profile", "github_deep", "huggingface_profile", "talks_serp"], sites: ["arxiv.org", "scholar.google.com", "openreview.net", "paperswithcode.com", "github.com"] },
  },
  {
    key: "nlp-engineer",
    title: "NLP Engineer",
    family: "data",
    aliases: ["nlp inženýr", "natural language processing engineer", "computational linguist", "inženýr zpracování přirozeného jazyka", "language model engineer"],
    profile: "makers",
    must_haves: [
      { id: "mh-nlp-systems", title: "NLP systems built", text: "Has built NLP pipelines (NER, classification, search, summarisation) shown publicly", accepted_evidence: ["repo", "demo", "blog post", "paper"] },
      { id: "mh-transformers", title: "Transformer models", text: "Has trained or fine-tuned transformer models, released on a model hub", accepted_evidence: ["model card", "repo", "notebook"] },
      { id: "mh-languages", title: "Multilingual or Czech work", text: "Has worked with non-English or low-resource language data", accepted_evidence: ["paper", "dataset listing", "repo"] },
      { id: "mh-publications", title: "Research output", text: "Has papers or shared-task results in NLP venues", accepted_evidence: ["paper", "competition ranking", "conference listing"] },
    ],
    sources: { steps: ["huggingface_profile", "github_profile", "github_deep", "openalex_author", "linkedin_profile", "talks_serp"], sites: ["huggingface.co", "github.com", "aclanthology.org", "arxiv.org", "paperswithcode.com"] },
  },
  {
    key: "computer-vision-engineer",
    title: "Computer Vision Engineer",
    family: "data",
    aliases: ["cv inženýr", "inženýr počítačového vidění", "vision engineer", "image processing engineer", "počítačové vidění"],
    profile: "makers",
    must_haves: [
      { id: "mh-vision-models", title: "Vision models built", text: "Has built detection, segmentation or recognition models with public code", accepted_evidence: ["repo", "model card", "demo", "paper"] },
      { id: "mh-deployment", title: "Edge or realtime deployment", text: "Has deployed vision models to edge, mobile or realtime systems", accepted_evidence: ["job history", "talk", "repo", "product launch"] },
      { id: "mh-datasets", title: "Data and annotation", text: "Has built or released datasets, or ranked in vision benchmarks", accepted_evidence: ["dataset listing", "competition ranking", "paper"] },
      { id: "mh-frameworks", title: "Vision frameworks", text: "Uses OpenCV, PyTorch or similar in public projects", accepted_evidence: ["repo", "notebook", "pull request"] },
    ],
    sources: { steps: ["github_profile", "github_deep", "huggingface_profile", "openalex_author", "linkedin_profile", "talks_serp"], sites: ["github.com", "paperswithcode.com", "kaggle.com", "arxiv.org", "huggingface.co"] },
  },
  {
    key: "data-architect",
    title: "Data Architect",
    family: "data",
    aliases: ["datový architekt", "enterprise data architect", "data platform architect", "architekt datových platforem"],
    profile: "track-record",
    must_haves: [
      { id: "mh-platform", title: "Data platform design", text: "Has designed a data platform or warehouse architecture, described publicly", accepted_evidence: ["talk", "blog post", "case study", "job history"] },
      { id: "mh-modeling", title: "Modeling and standards", text: "Shows data modeling, lineage or catalog standards work", accepted_evidence: ["blog post", "talk", "repo"] },
      { id: "mh-cloud", title: "Cloud data stack", text: "Holds cloud data certifications or documented AWS, Azure or GCP data work", accepted_evidence: ["certification listing", "job history"] },
      { id: "mh-scale", title: "Enterprise scale", text: "Has led data architecture at a company with multiple data teams", accepted_evidence: ["job history", "talk", "press"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "github_profile", "youtube_channel"], sites: ["medium.com", "linkedin.com", "speakerdeck.com", "dama.org"] },
  },
  {
    key: "head-of-data",
    title: "Head of Data",
    family: "data",
    aliases: ["vedoucí dat", "data director", "ředitel dat", "chief data officer", "cdo", "vp of data"],
    profile: "track-record",
    must_haves: [
      { id: "mh-team", title: "Data team leadership", text: "Has led a data team of 5 or more people, shown in job history or interviews", accepted_evidence: ["job history", "interview", "press"] },
      { id: "mh-strategy", title: "Data strategy delivered", text: "Has described a data strategy or platform rollout with business results", accepted_evidence: ["talk", "case study", "blog post", "interview"] },
      { id: "mh-visibility", title: "Public speaking", text: "Has spoken at data or industry conferences", accepted_evidence: ["talk", "conference listing", "podcast"] },
      { id: "mh-hands-on", title: "Technical credibility", text: "Shows technical depth through earlier hands-on roles, code or writing", accepted_evidence: ["job history", "repo", "blog post"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "youtube_channel", "x_profile", "personal_site_crawl"], sites: ["linkedin.com", "medium.com", "substack.com", "speakerdeck.com", "youtube.com"] },
  },
  {
    key: "data-product-manager",
    title: "Data Product Manager",
    family: "data",
    aliases: ["produktový manažer dat", "data pm", "product manager data platform", "ai product manager", "ml product manager"],
    profile: "track-record",
    must_haves: [
      { id: "mh-data-products", title: "Data products shipped", text: "Has shipped a data or ML-powered product, named in launches or press", accepted_evidence: ["product launch", "press", "case study", "job history"] },
      { id: "mh-metrics", title: "Metrics and outcomes", text: "Describes metrics or business outcomes of a data product", accepted_evidence: ["talk", "blog post", "case study"] },
      { id: "mh-technical", title: "Technical fluency", text: "Shows working knowledge of data pipelines, models or analytics tooling", accepted_evidence: ["blog post", "talk", "repo", "certification listing"] },
      { id: "mh-pm-community", title: "Product community voice", text: "Writes or speaks on data and product topics", accepted_evidence: ["talk", "blog post", "podcast"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "youtube_channel"], sites: ["mindtheproduct.com", "medium.com", "substack.com", "producthunt.com"] },
  },
  {
    key: "quantitative-analyst",
    title: "Quantitative Analyst",
    family: "data",
    aliases: ["kvantitativní analytik", "quant", "quant developer", "quantitative researcher", "kvantitativní vývojář"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-education", title: "Quantitative education", text: "Holds a degree or doctorate in mathematics, statistics, physics or finance", accepted_evidence: ["institution page", "thesis", "paper"] },
      { id: "mh-finance", title: "Finance domain work", text: "Has worked on pricing, risk or trading models at a named firm", accepted_evidence: ["job history", "paper", "talk"] },
      { id: "mh-code", title: "Quantitative coding", text: "Shows C++, Python or R implementations of quantitative methods", accepted_evidence: ["repo", "notebook", "blog post"] },
      { id: "mh-credentials", title: "Professional credentials", text: "Holds credentials such as CQF, CFA or FRM, or a competition ranking", accepted_evidence: ["certification listing", "competition ranking"] },
    ],
    sources: { steps: ["linkedin_profile", "openalex_author", "github_profile", "orcid_search", "stackexchange_profile"], sites: ["quantnet.com", "github.com", "ssrn.com", "arxiv.org", "kaggle.com"] },
  },
  {
    key: "business-analyst",
    title: "Business Analyst",
    family: "data",
    aliases: ["byznys analytik", "obchodní analytik", "business systems analyst", "it analytik", "business analytik", "byznys analytička", "business analytička"],
    profile: "track-record",
    must_haves: [
      { id: "mh-requirements", title: "Requirements work", text: "Has documented requirements, process models or user stories for named projects", accepted_evidence: ["job history", "case study", "portfolio"] },
      { id: "mh-certification", title: "BA certification", text: "Holds a BA credential (IIBA CBAP/CCBA, PMI-PBA, BCS)", accepted_evidence: ["certification listing", "registry entry"] },
      { id: "mh-domain", title: "Domain experience", text: "Shows multi-year work in a specific industry or system domain", accepted_evidence: ["job history", "blog post", "talk"] },
      { id: "mh-data", title: "Analysis tooling", text: "Uses SQL, Excel, BPMN or Jira in documented project work", accepted_evidence: ["job history", "portfolio", "certification listing"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "github_profile"], sites: ["iiba.org", "linkedin.com", "medium.com", "pmi.org"] },
  },
  {
    key: "data-steward",
    title: "Data Steward",
    family: "data",
    aliases: ["data governance specialist", "správce dat", "datový steward", "data governance manager", "data quality analyst", "správa dat", "head of data governance", "data governance lead"],
    profile: "credentialed",
    must_haves: [
      { id: "mh-governance", title: "Governance program work", text: "Has run data governance, catalog or quality programs at a named company", accepted_evidence: ["job history", "case study", "talk"] },
      { id: "mh-certification", title: "Governance certification", text: "Holds data management credentials (CDMP, DAMA, CIPP/E)", accepted_evidence: ["certification listing", "registry entry"] },
      { id: "mh-regulation", title: "Regulatory knowledge", text: "Shows GDPR or data regulation work in published material", accepted_evidence: ["blog post", "talk", "job history"] },
      { id: "mh-tooling", title: "Catalog and quality tools", text: "Has used a data catalog or quality tool (Collibra, Purview, Great Expectations)", accepted_evidence: ["job history", "certification listing", "blog post"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "github_profile"], sites: ["dama.org", "linkedin.com", "medium.com", "iapp.org"] },
  },
];
