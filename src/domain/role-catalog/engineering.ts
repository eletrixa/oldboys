/**
 * Role catalog: engineering family templates (software, infrastructure, security, QA, architecture, leadership, IT).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/engineering.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `ENGINEERING`: preselected engineering roles with EN/CZ aliases, observable must-haves and an evidence plan
 * - `DEV` (the shared developer step list) carries `github_deep` right after `github_profile` (6 steps, at the cap)
 *
 * Design constraints:
 * - Static data, relative imports only; must-haves are observable from public web evidence
 * - Never criteria about health, politics, religion, ethnicity, sexuality, age, family, personality or trustworthiness
 */
import type { RoleTemplate } from "./types";

type Mh = RoleTemplate["must_haves"][number];
const mh = (id: string, title: string, text: string, ...accepted_evidence: string[]): Mh => ({ id: `mh-${id}`, title, text, accepted_evidence });

const DEV = ["github_profile", "github_deep", "stackexchange_profile", "linkedin_profile", "personal_site_crawl", "talks_serp"] as const;
const LEAD = ["linkedin_profile", "talks_serp", "x_profile", "youtube_channel"] as const;

export const ENGINEERING: RoleTemplate[] = [
  {
    key: "backend-engineer", title: "Backend Engineer", family: "engineering", profile: "makers",
    aliases: ["backend developer", "vývojář backendu", "backend programátor", "server-side developer", "be engineer", "backend vývojář", "backend vývojář/ka", "back-end vývojář"],
    must_haves: [
      mh("production-services", "Production services", "Has shipped production backend services in Go, Java, Python or Node.js", "repo", "job history", "blog post"),
      mh("api-design", "API design", "Has designed or documented public REST, GraphQL or gRPC APIs", "docs site", "repo", "talk"),
      mh("datastores", "Datastore depth", "Shows work with relational or NoSQL databases and query tuning", "repo", "blog post", "talk"),
      mh("open-source-backend", "Open-source work", "Has merged contributions to backend open-source projects", "repo", "package"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "stackoverflow.com", "dev.to", "medium.com"] },
  },
  {
    key: "frontend-engineer", title: "Frontend Engineer", family: "engineering", profile: "makers",
    aliases: ["frontend developer", "front-end developer", "vývojář frontendu", "frontend programátor", "react developer", "react vývojář", "react vývojář/ka", "frontend vývojář", "frontend vývojář/ka", "front-end vývojář", "front-end vývojář/ka"],
    must_haves: [
      mh("framework-delivery", "Framework delivery", "Has shipped web apps in React, Vue, Angular or Svelte", "repo", "live site", "job history"),
      mh("typescript", "TypeScript use", "Public code written in TypeScript with typed components", "repo", "package"),
      mh("web-quality", "Web quality", "Shows work on accessibility, performance or Core Web Vitals", "blog post", "repo", "talk"),
      mh("ui-library", "Component libraries", "Has published or contributed to UI components or design systems", "package", "repo", "docs site"),
    ],
    sources: { steps: ["github_profile", "personal_site_crawl", "linkedin_profile", "stackexchange_profile", "talks_serp"], sites: ["github.com", "npmjs.com", "codepen.io", "dev.to", "stackoverflow.com"] },
  },
  {
    key: "full-stack-engineer", title: "Full-Stack Engineer", family: "engineering", profile: "makers",
    aliases: ["full stack developer", "fullstack developer", "fullstack programátor", "full-stack vývojář", "web developer", "webový vývojář", "full stack engineer", "fullstack engineer", "full-stack developer", "fullstack vývojář", "full-stack vývojář/ka", "fullstack vývojář/ka", "full stack vývojář"],
    must_haves: [
      mh("end-to-end-apps", "End-to-end apps", "Has built and deployed web apps covering UI, API and database", "repo", "live site", "job history"),
      mh("backend-and-frontend", "Both stacks", "Public code in both a frontend framework and a server language", "repo", "package"),
      mh("deployment", "Deployment skills", "Shows CI/CD or cloud hosting setup for own projects", "repo", "blog post", "docs site"),
      mh("product-ownership", "Feature ownership", "Has owned features from design to production in a product team", "job history", "blog post", "talk"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "stackoverflow.com", "npmjs.com", "dev.to", "producthunt.com"] },
  },
  {
    key: "ios-engineer", title: "iOS Engineer", family: "engineering", profile: "makers",
    aliases: ["ios developer", "mobile engineer ios", "vývojář ios", "ios programátor", "swift developer", "iphone developer", "software engineer ios", "ios software engineer", "ios vývojář"],
    must_haves: [
      mh("app-store-apps", "App Store apps", "Has apps or SDKs published on the Apple App Store", "app store listing", "repo", "job history"),
      mh("swift-swiftui", "Swift and SwiftUI", "Public code in Swift using SwiftUI or UIKit", "repo", "package", "blog post"),
      mh("apple-platform-depth", "Platform depth", "Shows work with Core Data, concurrency or Apple frameworks", "repo", "blog post", "talk"),
      mh("release-cadence", "Release track record", "Has maintained apps through multiple versioned releases", "app store listing", "changelog", "job history"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "apps.apple.com", "stackoverflow.com", "swiftpackageindex.com", "medium.com"] },
  },
  {
    key: "android-engineer", title: "Android Engineer", family: "engineering", profile: "makers",
    aliases: ["android developer", "mobile engineer android", "vývojář androidu", "android programátor", "kotlin developer"],
    must_haves: [
      mh("play-store-apps", "Play Store apps", "Has apps or SDKs published on Google Play", "app store listing", "repo", "job history"),
      mh("kotlin-compose", "Kotlin and Compose", "Public code in Kotlin using Jetpack libraries or Compose", "repo", "package", "blog post"),
      mh("architecture-patterns", "App architecture", "Shows MVVM, dependency injection or modularisation in public code", "repo", "blog post", "talk"),
      mh("release-cadence", "Release track record", "Has maintained apps through multiple versioned releases", "app store listing", "changelog", "job history"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "play.google.com", "stackoverflow.com", "medium.com", "androidweekly.net"] },
  },
  {
    key: "cross-platform-mobile-engineer", title: "React Native / Flutter Engineer", family: "engineering", profile: "makers",
    aliases: ["react native developer", "flutter developer", "cross-platform mobile developer", "vývojář flutteru", "vývojář react native", "mobilní vývojář"],
    must_haves: [
      mh("cross-platform-apps", "Cross-platform apps", "Has shipped apps built with React Native or Flutter to both stores", "app store listing", "repo", "job history"),
      mh("framework-code", "Framework code", "Public code in Dart or TypeScript for a mobile framework", "repo", "package"),
      mh("native-bridges", "Native integration", "Has written native modules, plugins or platform channels", "repo", "package", "blog post"),
      mh("package-publishing", "Published packages", "Has published packages on pub.dev or npm", "package", "docs site"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "pub.dev", "npmjs.com", "apps.apple.com", "play.google.com"] },
  },
  {
    key: "devops-engineer", title: "DevOps Engineer", family: "engineering", profile: "makers",
    aliases: ["vývojář devops", "devops inženýr", "ci/cd engineer", "infrastructure engineer", "devops specialist", "devops specialista", "devops developer"],
    must_haves: [
      mh("ci-cd-pipelines", "CI/CD pipelines", "Has built CI/CD pipelines with GitHub Actions, GitLab CI or Jenkins", "repo", "job history", "blog post"),
      mh("infrastructure-as-code", "Infrastructure as code", "Public Terraform, Pulumi or Ansible code for real environments", "repo", "package"),
      mh("containers-orchestration", "Containers", "Shows Docker and Kubernetes work, charts or images", "repo", "package", "talk"),
      mh("cloud-certified", "Cloud credentials", "Holds a listed AWS, Azure or GCP professional certification", "certification listing", "profile"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "talks_serp", "personal_site_crawl"], sites: ["github.com", "hub.docker.com", "registry.terraform.io", "artifacthub.io", "stackoverflow.com"] },
  },
  {
    key: "site-reliability-engineer", title: "Site Reliability Engineer", family: "engineering", profile: "makers",
    aliases: ["sre", "reliability engineer", "sre inženýr", "inženýr spolehlivosti", "production engineer"],
    must_haves: [
      mh("slo-incident", "SLOs and incidents", "Has written about SLOs, incident response or postmortems", "blog post", "talk", "docs site"),
      mh("observability", "Observability tooling", "Shows work with Prometheus, Grafana or OpenTelemetry", "repo", "package", "talk"),
      mh("kubernetes-scale", "Scale operations", "Has operated Kubernetes or large distributed systems in production", "job history", "talk", "blog post"),
      mh("automation-code", "Automation code", "Public code automating operations in Go or Python", "repo", "package"),
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "talks_serp", "personal_site_crawl", "stackexchange_profile"], sites: ["github.com", "sre.google", "speakerdeck.com", "medium.com", "stackoverflow.com"] },
  },
  {
    key: "platform-engineer", title: "Platform Engineer", family: "engineering", profile: "makers",
    aliases: ["internal platform engineer", "platformní inženýr", "developer platform engineer", "idp engineer"],
    must_haves: [
      mh("internal-platform", "Internal platform", "Has built internal developer platforms or self-service tooling", "job history", "talk", "blog post"),
      mh("kubernetes-ops", "Kubernetes tooling", "Public Kubernetes operators, controllers or Helm charts", "repo", "package"),
      mh("iac-modules", "Reusable IaC", "Has published reusable Terraform modules or templates", "package", "repo"),
      mh("platform-talks", "Platform talks", "Has spoken or written on platform engineering practice", "talk", "blog post", "conference bio"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "talks_serp", "personal_site_crawl", "stackexchange_profile"], sites: ["github.com", "registry.terraform.io", "artifacthub.io", "hub.docker.com", "speakerdeck.com"] },
  },
  {
    key: "cloud-engineer", title: "Cloud Engineer", family: "engineering", profile: "makers",
    aliases: ["cloud developer", "cloud inženýr", "aws engineer", "azure engineer", "gcp engineer", "cloud specialista"],
    must_haves: [
      mh("cloud-certified", "Cloud certification", "Holds a listed AWS, Azure or Google Cloud associate or professional certification", "certification listing", "profile"),
      mh("cloud-deployments", "Cloud deployments", "Has deployed workloads on a major cloud, shown in code or write-ups", "repo", "blog post", "job history"),
      mh("iac-cloud", "Infrastructure as code", "Public Terraform, CloudFormation or Bicep templates", "repo", "package"),
      mh("cloud-security-cost", "Security and cost", "Shows work on IAM hardening, networking or cost optimisation", "blog post", "talk", "repo"),
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "credly.com", "registry.terraform.io", "medium.com", "stackoverflow.com"] },
  },
  {
    key: "security-engineer", title: "Security Engineer", family: "engineering", profile: "makers",
    aliases: ["cybersecurity engineer", "infosec engineer", "bezpečnostní inženýr", "kyberbezpečnostní specialista", "security specialist"],
    must_haves: [
      mh("security-tooling", "Security tooling", "Has built or contributed to public security tools or detections", "repo", "package"),
      mh("vuln-credits", "Vulnerability credits", "Is credited in CVEs, advisories or bug bounty hall-of-fame lists", "CVE credit", "advisory", "bounty profile"),
      mh("security-certs", "Security certifications", "Holds a listed security certification such as CISSP, OSCP or GIAC", "certification listing", "profile"),
      mh("security-writing", "Security research", "Has published security write-ups, talks or conference presentations", "blog post", "talk", "conference bio"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "talks_serp", "x_profile", "personal_site_crawl", "stackexchange_profile"], sites: ["github.com", "hackerone.com", "cve.org", "exploit-db.com", "credly.com"] },
  },
  {
    key: "application-security-engineer", title: "Application Security Engineer", family: "engineering", profile: "makers",
    aliases: ["appsec engineer", "product security engineer", "secure code reviewer", "inženýr aplikační bezpečnosti", "devsecops engineer"],
    must_haves: [
      mh("secure-code-review", "Secure code review", "Has found or fixed vulnerabilities in public code, shown by advisories or PRs", "CVE credit", "advisory", "repo"),
      mh("sast-dast-tooling", "AppSec tooling", "Public rules, scanners or pipeline integrations for SAST or DAST", "repo", "package"),
      mh("owasp-involvement", "OWASP involvement", "Contributes to OWASP projects or speaks at AppSec events", "talk", "conference bio", "repo"),
      mh("appsec-writing", "AppSec writing", "Has published secure-coding guidance or threat-modelling write-ups", "blog post", "docs site"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "talks_serp", "personal_site_crawl", "x_profile"], sites: ["github.com", "owasp.org", "hackerone.com", "cve.org", "speakerdeck.com"] },
  },
  {
    key: "penetration-tester", title: "Penetration Tester", family: "engineering", profile: "makers",
    aliases: ["pentester", "ethical hacker", "penetrační tester", "etický hacker", "red team operator", "pen tester"],
    must_haves: [
      mh("offensive-certs", "Offensive certifications", "Holds a listed offensive certification such as OSCP, OSEP or GPEN", "certification listing", "profile"),
      mh("disclosed-vulns", "Disclosed vulnerabilities", "Has CVE credits or bug bounty disclosures under own name", "CVE credit", "bounty profile", "advisory"),
      mh("ctf-record", "CTF record", "Has ranked results on public CTF or lab platforms", "ctf profile", "blog post"),
      mh("exploit-tooling", "Offensive tooling", "Has published exploits, scripts or testing tools", "repo", "package"),
    ],
    sources: { steps: ["github_profile", "x_profile", "talks_serp", "linkedin_profile", "personal_site_crawl"], sites: ["hackerone.com", "bugcrowd.com", "cve.org", "exploit-db.com", "github.com"] },
  },
  {
    key: "manual-qa-engineer", title: "QA Engineer (Manual)", family: "engineering", profile: "makers",
    aliases: ["manual tester", "qa tester", "softwarový tester", "manuální tester", "qa specialist", "software tester", "sw tester", "test analytik", "test analyst", "qa analyst"],
    must_haves: [
      mh("test-design", "Test design", "Has written test plans, cases or exploratory testing reports", "blog post", "job history", "docs site"),
      mh("defect-reporting", "Defect reporting", "Has filed bugs in public issue trackers or bug-bounty programs", "issue tracker", "bounty profile"),
      mh("istqb", "Testing certification", "Holds a listed ISTQB or equivalent testing certification", "certification listing", "profile"),
      mh("testing-community", "Testing community", "Has spoken or written in testing communities", "talk", "blog post", "conference bio"),
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "github_profile", "stackexchange_profile"], sites: ["linkedin.com", "medium.com", "ministryoftesting.com", "github.com", "testrail.com"] },
  },
  {
    key: "test-automation-engineer", title: "Test Automation Engineer", family: "engineering", profile: "makers",
    aliases: ["sdet", "qa automation engineer", "automatizovaný tester", "automation tester", "inženýr testovací automatizace", "software developer in test"],
    must_haves: [
      mh("e2e-frameworks", "E2E frameworks", "Public test suites in Playwright, Cypress or Selenium", "repo", "package", "blog post"),
      mh("api-test-automation", "API test automation", "Has automated API or contract tests in code", "repo", "blog post"),
      mh("ci-integration", "CI integration", "Shows test suites running in CI pipelines", "repo", "job history", "docs site"),
      mh("test-tooling", "Test tooling", "Has built or contributed to test libraries or frameworks", "package", "repo", "talk"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "npmjs.com", "stackoverflow.com", "ministryoftesting.com", "medium.com"] },
  },
  {
    key: "embedded-engineer", title: "Embedded Engineer", family: "engineering", profile: "makers",
    aliases: ["embedded developer", "embedded software engineer", "vývojář embedded", "embedded programátor", "mcu developer", "vestavěné systémy", "embedded vývojář", "embedded vývojář/ka", "embedded hw/sw vývojář", "embedded linux vývojář", "embedded linux vývojář/ka"],
    must_haves: [
      mh("c-cpp-embedded", "C/C++ embedded", "Public embedded code in C, C++ or Rust for microcontrollers", "repo", "package"),
      mh("rtos-experience", "RTOS experience", "Shows work with FreeRTOS, Zephyr or similar real-time systems", "repo", "blog post", "talk"),
      mh("hardware-shipped", "Shipped hardware", "Has contributed to shipped devices or open hardware projects", "job history", "repo", "product page"),
      mh("peripheral-protocols", "Protocol work", "Shows SPI, I2C, CAN or BLE driver and protocol work", "repo", "blog post"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "hackaday.io", "stackoverflow.com", "platformio.org", "electronics.stackexchange.com"] },
  },
  {
    key: "firmware-engineer", title: "Firmware Engineer", family: "engineering", profile: "makers",
    aliases: ["firmware developer", "vývojář firmwaru", "firmware programátor", "low-level engineer", "bsp engineer"],
    must_haves: [
      mh("firmware-code", "Firmware code", "Public firmware or bootloader code in C, C++ or Rust", "repo", "package"),
      mh("driver-bringup", "Board bring-up", "Shows driver development or board bring-up work", "repo", "blog post", "talk"),
      mh("upstream-contributions", "Upstream patches", "Has merged patches to Linux kernel, U-Boot or vendor SDKs", "repo", "mailing list"),
      mh("shipped-products", "Shipped products", "Has worked on firmware for commercial devices", "job history", "product page"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "hackaday.io", "lore.kernel.org", "stackoverflow.com", "electronics.stackexchange.com"] },
  },
  {
    key: "game-developer", title: "Game Developer", family: "engineering", profile: "makers",
    aliases: ["game programmer", "gameplay programmer", "vývojář her", "herní programátor", "unity developer", "unreal developer"],
    must_haves: [
      mh("shipped-games", "Shipped games", "Has credited titles on Steam, consoles or mobile stores", "steam page", "app store listing", "credits listing"),
      mh("engine-skills", "Engine skills", "Public projects in Unity, Unreal or Godot", "repo", "itch.io page", "demo reel"),
      mh("game-jams", "Game jams", "Has entries in public game jams or prototypes", "itch.io page", "jam listing"),
      mh("graphics-gameplay-code", "Gameplay code", "Public code for gameplay systems, shaders or tools", "repo", "blog post", "talk"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "youtube_channel", "personal_site_crawl", "talks_serp"], sites: ["itch.io", "store.steampowered.com", "github.com", "mobygames.com", "gamedev.net"] },
  },
  {
    key: "blockchain-engineer", title: "Blockchain / Smart-Contract Engineer", family: "engineering", profile: "makers",
    aliases: ["smart contract developer", "solidity developer", "web3 developer", "blockchain developer", "vývojář smart kontraktů", "blockchain vývojář"],
    must_haves: [
      mh("deployed-contracts", "Deployed contracts", "Has smart contracts deployed on a public chain under a traceable address", "block explorer", "repo", "docs site"),
      mh("solidity-rust-code", "Contract code", "Public Solidity, Vyper or Rust contract code with tests", "repo", "package"),
      mh("audits-contests", "Audits and contests", "Appears in audit reports or public audit contest results", "audit report", "contest listing", "blog post"),
      mh("protocol-contributions", "Protocol work", "Has contributed to open-source protocols or tooling", "repo", "docs site", "talk"),
    ],
    sources: { steps: ["github_profile", "x_profile", "linkedin_profile", "talks_serp", "personal_site_crawl"], sites: ["github.com", "etherscan.io", "code4rena.com", "sherlock.xyz", "ethereum.stackexchange.com"] },
  },
  {
    key: "solutions-architect", title: "Solutions Architect", family: "engineering", profile: "makers",
    aliases: ["solution architect", "řešitelský architekt", "architekt řešení", "cloud solutions architect", "technical architect", "cloud architect", "cloud architekt", "infrastructure architect", "it architect", "it architekt", "system architect", "systems architect", "systémový architekt"],
    must_haves: [
      mh("architecture-delivery", "Architecture delivery", "Has designed and delivered multi-system solutions for named organisations", "job history", "case study", "talk"),
      mh("cloud-architecture-cert", "Architect certification", "Holds a listed architect-level cloud certification", "certification listing", "profile"),
      mh("reference-architectures", "Reference designs", "Has published architecture diagrams, patterns or write-ups", "blog post", "docs site", "repo"),
      mh("customer-facing", "Customer-facing talks", "Has presented solutions at conferences or webinars", "talk", "conference bio", "video"),
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "github_profile", "personal_site_crawl", "youtube_channel"], sites: ["linkedin.com", "credly.com", "medium.com", "speakerdeck.com", "github.com"] },
  },
  {
    key: "software-architect", title: "Software Architect", family: "engineering", profile: "makers",
    aliases: ["softwarový architekt", "application architect", "enterprise architect", "principal architect"],
    must_haves: [
      mh("system-design", "System design", "Has published system designs, ADRs or architecture write-ups", "blog post", "docs site", "repo"),
      mh("large-scale-systems", "Large-scale systems", "Has led architecture of production systems at scale", "job history", "talk", "case study"),
      mh("hands-on-code", "Hands-on code", "Still shows recent public code or design prototypes", "repo", "package"),
      mh("architecture-talks", "Architecture talks", "Has spoken or written on architecture practice", "talk", "conference bio", "blog post"),
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "talks_serp", "personal_site_crawl", "stackexchange_profile"], sites: ["github.com", "infoq.com", "medium.com", "speakerdeck.com", "dev.to"] },
  },
  {
    key: "engineering-manager", title: "Engineering Manager", family: "engineering", profile: "track-record",
    aliases: ["software engineering manager", "vedoucí vývoje", "manažer vývoje", "team manager engineering", "software development manager"],
    must_haves: [
      mh("team-leadership", "Team leadership", "Has led an engineering team at a named company", "job history", "profile", "press"),
      mh("delivery-outcomes", "Delivery outcomes", "Products or platforms shipped under their leadership are publicly documented", "press", "product page", "job history"),
      mh("management-writing", "Management writing", "Has written or spoken on engineering management practice", "blog post", "talk", "podcast"),
      mh("technical-background", "Technical background", "Shows prior hands-on engineering work", "repo", "job history", "blog post"),
    ],
    sources: { steps: [...LEAD], sites: ["linkedin.com", "medium.com", "github.com", "crunchbase.com"] },
  },
  {
    key: "vp-engineering", title: "VP of Engineering", family: "engineering", profile: "track-record",
    aliases: ["vp engineering", "vice president of engineering", "viceprezident pro vývoj", "head of engineering", "ředitel vývoje", "director of engineering"],
    must_haves: [
      mh("org-scale", "Organisation scale", "Has led an engineering organisation of 50 or more people, per profile or press", "job history", "press", "conference bio"),
      mh("company-outcomes", "Company outcomes", "Led engineering at companies with funding, exits or notable launches", "press", "crunchbase listing", "job history"),
      mh("executive-visibility", "Executive visibility", "Has talks, interviews or podcasts on leading engineering", "talk", "podcast", "interview"),
      mh("board-advisor", "Advisory roles", "Holds listed advisory or board roles in technology companies", "company page", "press", "profile"),
    ],
    sources: { steps: [...LEAD, "personal_site_crawl"], sites: ["linkedin.com", "crunchbase.com", "techcrunch.com", "medium.com"] },
  },
  {
    key: "cto", title: "CTO", family: "engineering", profile: "track-record",
    aliases: ["chief technology officer", "technický ředitel", "technologický ředitel", "technical co-founder", "technický zakladatel"],
    must_haves: [
      mh("tech-leadership", "Technology leadership", "Has served as CTO or technical founder at a named company", "job history", "company page", "press"),
      mh("company-outcomes", "Company outcomes", "Companies they led technology for have funding, exits or traction on record", "press", "crunchbase listing", "company page"),
      mh("technical-credibility", "Technical credibility", "Shows own code, patents or technical publications", "repo", "patent", "blog post"),
      mh("public-voice", "Public voice", "Has conference talks, interviews or podcasts on technology strategy", "talk", "podcast", "interview"),
    ],
    sources: { steps: [...LEAD, "github_profile"], sites: ["linkedin.com", "crunchbase.com", "techcrunch.com", "github.com", "patents.google.com"] },
  },
  {
    key: "tech-lead", title: "Tech Lead", family: "engineering", profile: "makers",
    aliases: ["technical lead", "team lead developer", "tech leader", "vedoucí týmu vývojářů", "technický vedoucí", "lead developer"],
    must_haves: [
      mh("led-delivery", "Led delivery", "Has led technical delivery of a product or major feature at a named company", "job history", "case study", "blog post"),
      mh("code-craft", "Code craft", "Public code showing design quality, tests and documentation", "repo", "package", "docs site"),
      mh("technical-writing", "Technical writing", "Has published design write-ups, ADRs or technical blog posts", "blog post", "docs site", "talk"),
      mh("mentoring-visible", "Visible mentoring", "Has public talks, workshops or reviews that teach others", "talk", "blog post", "conference bio"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "stackoverflow.com", "medium.com", "dev.to", "speakerdeck.com"] },
  },
  {
    key: "staff-engineer", title: "Staff Engineer", family: "engineering", profile: "makers",
    aliases: ["principal engineer", "staff software engineer", "senior staff engineer", "hlavní inženýr", "distinguished engineer"],
    must_haves: [
      mh("cross-team-impact", "Cross-team impact", "Has led technical work spanning several teams, shown in write-ups or talks", "blog post", "talk", "job history"),
      mh("open-source-maintainer", "Open-source maintainer", "Maintains or core-contributes to a widely used open-source project", "repo", "package"),
      mh("technical-influence", "Technical influence", "Has authored RFCs, specs, patents or influential posts", "patent", "blog post", "docs site"),
      mh("conference-speaker", "Conference speaker", "Has spoken at engineering conferences", "talk", "conference bio", "video"),
    ],
    sources: { steps: ["github_profile", "talks_serp", "linkedin_profile", "personal_site_crawl", "stackexchange_profile"], sites: ["github.com", "speakerdeck.com", "medium.com", "stackoverflow.com", "patents.google.com"] },
  },
  {
    key: "database-administrator", title: "Database Administrator", family: "engineering", profile: "credentialed",
    aliases: ["dba", "správce databází", "databázový administrátor", "database engineer", "postgres dba", "sql dba"],
    must_haves: [
      mh("dbms-certified", "Database certification", "Holds a listed Oracle, Microsoft, MongoDB or PostgreSQL certification", "certification listing", "profile"),
      mh("production-dba", "Production operations", "Has run production databases covering backup, replication and tuning", "job history", "blog post", "talk"),
      mh("sql-expertise", "SQL expertise", "Has strong answers or posts on query optimisation and schema design", "stackoverflow profile", "blog post"),
      mh("dba-community", "Community presence", "Has talks, scripts or extensions shared with the database community", "talk", "repo", "package"),
    ],
    sources: { steps: ["linkedin_profile", "stackexchange_profile", "github_profile", "talks_serp", "personal_site_crawl"], sites: ["dba.stackexchange.com", "stackoverflow.com", "github.com", "credly.com", "medium.com"] },
  },
  {
    key: "network-engineer", title: "Network Engineer", family: "engineering", profile: "credentialed",
    aliases: ["network administrator", "správce sítě", "síťový inženýr", "síťový specialista", "network specialist", "ccna engineer"],
    must_haves: [
      mh("network-certified", "Network certification", "Holds a listed Cisco, Juniper or equivalent certification such as CCNA or CCNP", "certification listing", "profile"),
      mh("enterprise-networks", "Network operations", "Has designed or operated enterprise or ISP networks", "job history", "case study", "profile"),
      mh("routing-switching", "Routing and switching", "Shows BGP, OSPF or VLAN work in write-ups or labs", "blog post", "repo", "talk"),
      mh("network-automation", "Network automation", "Public Ansible, Python or Netmiko scripts for network devices", "repo", "package"),
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["networkengineering.stackexchange.com", "github.com", "credly.com", "peeringdb.com", "stackoverflow.com"] },
  },
  {
    key: "systems-administrator", title: "Systems Administrator", family: "engineering", profile: "credentialed",
    aliases: ["sysadmin", "system administrator", "správce systémů", "systémový administrátor", "linux administrator", "it administrátor"],
    must_haves: [
      mh("sysadmin-certified", "Admin certification", "Holds a listed RHCSA, LPIC, Microsoft or VMware certification", "certification listing", "profile"),
      mh("server-operations", "Server operations", "Has administered Linux or Windows server estates in named organisations", "job history", "profile"),
      mh("scripting-automation", "Scripting automation", "Public Bash, PowerShell or Ansible scripts", "repo", "package"),
      mh("sysadmin-knowledge", "Shared knowledge", "Has helpful answers or guides on server administration", "stackexchange profile", "blog post"),
    ],
    sources: { steps: ["linkedin_profile", "stackexchange_profile", "github_profile", "personal_site_crawl", "talks_serp"], sites: ["serverfault.com", "github.com", "unix.stackexchange.com", "credly.com", "stackoverflow.com"] },
  },
  {
    key: "it-support-specialist", title: "IT Support Specialist", family: "engineering", profile: "verify-only",
    aliases: ["help desk technician", "it podpora", "technická podpora", "it support", "service desk analyst", "helpdesk"],
    must_haves: [
      mh("support-experience", "Support experience", "Has held IT support or service desk roles at named organisations", "job history", "profile"),
      mh("it-certified", "IT certification", "Holds a listed CompTIA A+, ITIL or Microsoft certification", "certification listing", "profile"),
      mh("endpoint-tools", "Endpoint tooling", "Lists experience with Active Directory, Microsoft 365 or ticketing tools", "profile", "job history"),
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "github_profile", "stackexchange_profile"], sites: ["linkedin.com", "credly.com", "superuser.com", "serverfault.com"] },
  },
  {
    key: "release-build-engineer", title: "Release / Build Engineer", family: "engineering", profile: "makers",
    aliases: ["build engineer", "release engineer", "build and release engineer", "inženýr sestavení", "release manager engineering", "build systems engineer"],
    must_haves: [
      mh("build-systems", "Build systems", "Public build configuration in Bazel, Gradle, CMake or Make", "repo", "package"),
      mh("release-pipelines", "Release pipelines", "Has built automated release and packaging pipelines", "repo", "job history", "blog post"),
      mh("artifact-management", "Artifact management", "Shows work with package registries, signing or reproducible builds", "repo", "package", "docs site"),
      mh("build-talks", "Build engineering writing", "Has written or spoken on build and release practice", "blog post", "talk", "conference bio"),
    ],
    sources: { steps: ["github_profile", "linkedin_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "stackoverflow.com", "hub.docker.com", "medium.com", "npmjs.com"] },
  },
  {
    key: "salesforce-developer", title: "Salesforce Developer", family: "engineering", profile: "credentialed",
    aliases: ["sfdc developer", "apex developer", "vývojář salesforce", "salesforce programátor", "lightning developer", "salesforce engineer"],
    must_haves: [
      mh("salesforce-certified", "Salesforce certification", "Holds a listed Salesforce Platform Developer certification", "certification listing", "trailblazer profile"),
      mh("apex-lwc", "Apex and LWC", "Public Apex or Lightning Web Components code", "repo", "package", "blog post"),
      mh("trailhead-record", "Trailhead record", "Has a public Trailblazer profile with badges and ranks", "trailblazer profile", "profile"),
      mh("org-implementations", "Org implementations", "Has delivered Salesforce implementations or integrations for named clients", "job history", "case study"),
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["trailblazer.me", "github.com", "salesforce.stackexchange.com", "appexchange.salesforce.com", "linkedin.com"] },
  },
  {
    key: "sap-consultant", title: "SAP Consultant / Developer", family: "engineering", profile: "credentialed",
    aliases: ["sap developer", "sap konzultant", "abap developer", "sap vývojář", "sap specialist", "s/4hana consultant", "sap konzultant/ka", "sap consultant"],
    must_haves: [
      mh("sap-certified", "SAP certification", "Holds a listed SAP certification for a relevant module", "certification listing", "profile"),
      mh("module-expertise", "Module expertise", "Has implemented SAP modules such as FI/CO, MM, SD or S/4HANA", "job history", "case study", "profile"),
      mh("abap-btp-code", "ABAP and BTP code", "Public ABAP, CAP or SAP BTP code samples", "repo", "blog post"),
      mh("sap-community", "SAP community", "Has a SAP Community profile with blog posts or answers", "sap community profile", "blog post"),
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "stackexchange_profile", "personal_site_crawl", "talks_serp"], sites: ["community.sap.com", "github.com", "linkedin.com", "stackoverflow.com", "credly.com"] },
  },
  {
    key: "wordpress-php-developer", title: "WordPress / PHP Developer", family: "engineering", profile: "makers",
    aliases: ["wordpress developer", "php developer", "php programátor", "vývojář wordpressu", "php vývojář", "laravel developer", "php backend developer"],
    must_haves: [
      mh("wordpress-plugins", "WordPress plugins", "Has plugins or themes listed on wordpress.org", "plugin listing", "repo"),
      mh("php-frameworks", "PHP frameworks", "Public PHP code in Laravel, Symfony or WordPress core style", "repo", "package"),
      mh("composer-packages", "Published packages", "Has packages published on Packagist", "package", "repo"),
      mh("client-sites", "Delivered sites", "Has delivered live WordPress or PHP sites for named clients", "live site", "portfolio", "job history"),
    ],
    sources: { steps: ["github_profile", "stackexchange_profile", "personal_site_crawl", "linkedin_profile", "talks_serp"], sites: ["wordpress.org", "github.com", "packagist.org", "wordpress.stackexchange.com", "stackoverflow.com"] },
  },
  {
    key: "dotnet-developer", title: ".NET Developer", family: "engineering", profile: "makers",
    aliases: ["dotnet developer", "c# developer", "vývojář .net", "c# programátor", "asp.net developer", ".net programátor", "programátor .net", ".net vývojář", "c# vývojář", "c#/.net vývojář", "c#/.net backend vývojář", "c#/.net developer"],
    must_haves: [
      mh("csharp-code", "C# code", "Public C# code on .NET 6 or later with tests", "repo", "package"),
      mh("nuget-packages", "NuGet packages", "Has packages published on NuGet or contributions to .NET projects", "package", "repo"),
      mh("aspnet-services", "ASP.NET services", "Has shipped ASP.NET Core web APIs or services", "repo", "job history", "blog post"),
      mh("microsoft-credentials", "Microsoft credentials", "Holds a listed Microsoft Azure or .NET certification or MVP award", "certification listing", "mvp profile"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "nuget.org", "stackoverflow.com", "learn.microsoft.com", "dev.to"] },
  },
  {
    key: "java-developer", title: "Java Developer", family: "engineering", profile: "makers",
    aliases: ["java engineer", "vývojář javy", "java programátor", "spring developer", "kotlin/java developer", "jvm developer", "java vývojář", "java vývojář/ka", "java vývojářka", "java vývojář / vývojářka"],
    must_haves: [
      mh("java-spring-services", "Java services", "Has shipped production services in Java with Spring or Quarkus", "repo", "job history", "blog post"),
      mh("maven-central", "Published artifacts", "Has libraries published on Maven Central", "package", "repo"),
      mh("jvm-depth", "JVM depth", "Shows concurrency, JVM tuning or testing practice", "blog post", "talk", "repo"),
      mh("oss-java", "Open-source Java", "Has merged contributions to Java open-source projects", "repo", "package"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "central.sonatype.com", "stackoverflow.com", "baeldung.com", "dev.to"] },
  },
  {
    key: "python-developer", title: "Python Developer", family: "engineering", profile: "makers",
    aliases: ["python engineer", "vývojář pythonu", "python programátor", "django developer", "fastapi developer", "pythonista"],
    must_haves: [
      mh("python-services", "Python services", "Has shipped production Python services with Django, FastAPI or Flask", "repo", "job history", "blog post"),
      mh("pypi-packages", "PyPI packages", "Has packages published on PyPI", "package", "repo"),
      mh("typing-testing", "Typing and tests", "Public Python code with type hints and a test suite", "repo", "package"),
      mh("python-community", "Python community", "Has talks, answers or contributions in the Python community", "talk", "stackexchange profile", "repo"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "pypi.org", "stackoverflow.com", "realpython.com", "sessionize.com"] },
  },
  {
    key: "nodejs-developer", title: "Node.js Developer", family: "engineering", profile: "makers",
    aliases: ["node developer", "nodejs engineer", "vývojář node.js", "node.js programátor", "javascript backend developer", "typescript backend developer"],
    must_haves: [
      mh("node-services", "Node.js services", "Has shipped production Node.js services with Express, Fastify or NestJS", "repo", "job history", "blog post"),
      mh("npm-packages", "npm packages", "Has packages published on npm", "package", "repo"),
      mh("typescript-backend", "TypeScript backend", "Public server-side code written in TypeScript with tests", "repo", "package"),
      mh("async-performance", "Async and performance", "Shows work on event-loop, streaming or performance tuning", "blog post", "talk", "repo"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "npmjs.com", "stackoverflow.com", "dev.to", "medium.com"] },
  },
  {
    key: "go-rust-engineer", title: "Go / Rust Engineer", family: "engineering", profile: "makers",
    aliases: ["golang developer", "rust developer", "go developer", "vývojář go", "vývojář rustu", "systems programmer"],
    must_haves: [
      mh("go-rust-code", "Go or Rust code", "Public Go or Rust projects with tests and documentation", "repo", "package"),
      mh("published-crates-modules", "Published modules", "Has crates on crates.io or modules on pkg.go.dev", "package", "docs site"),
      mh("systems-services", "Systems and services", "Has shipped network services, CLIs or infrastructure tools in Go or Rust", "repo", "job history", "blog post"),
      mh("oss-contributions", "Open-source contributions", "Has merged contributions to Go or Rust open-source projects", "repo", "package"),
    ],
    sources: { steps: [...DEV], sites: ["github.com", "crates.io", "pkg.go.dev", "users.rust-lang.org", "stackoverflow.com"] },
  },
  {
    key: "developer-advocate", title: "Developer Advocate", family: "engineering", profile: "audience",
    aliases: ["devrel", "developer relations engineer", "developer evangelist", "developer relations", "technický evangelista", "evangelista pro vývojáře"],
    must_haves: [
      mh("conference-talks", "Conference talks", "Has given talks at developer conferences", "talk", "conference bio", "video"),
      mh("technical-content", "Technical content", "Has published tutorials, videos or blog posts for developers", "blog post", "video", "docs site"),
      mh("sample-code", "Sample code", "Public demo apps, SDK samples or starter repos", "repo", "package"),
      mh("community-reach", "Community reach", "Has a measurable public following or community leadership", "social profile", "meetup page", "newsletter"),
    ],
    sources: { steps: ["talks_serp", "x_profile", "youtube_channel", "github_profile", "linkedin_profile", "bluesky_profile"], sites: ["sessionize.com", "github.com", "dev.to", "youtube.com", "speakerdeck.com"] },
  },
  {
    key: "technical-writer", title: "Technical Writer", family: "engineering", profile: "makers",
    aliases: ["documentation engineer", "technický pisatel", "technický redaktor", "docs writer", "api documentation writer", "tech writer"],
    must_haves: [
      mh("published-docs", "Published docs", "Has documentation sites or API references with a named author or commit history", "docs site", "repo"),
      mh("docs-as-code", "Docs as code", "Shows docs-as-code work in Markdown, Sphinx or Docusaurus repos", "repo", "docs site"),
      mh("writing-portfolio", "Writing portfolio", "Has a public portfolio of tutorials, guides or articles", "portfolio", "blog post", "personal site"),
      mh("tw-community", "Community involvement", "Has talks or posts in technical communication communities", "talk", "blog post", "conference bio"),
    ],
    sources: { steps: ["personal_site_crawl", "github_profile", "linkedin_profile", "talks_serp", "stackexchange_profile"], sites: ["github.com", "medium.com", "writethedocs.org", "dev.to", "readthedocs.io"] },
  },
  {
    key: "software-engineer", title: "Software Engineer", family: "engineering", profile: "makers",
    aliases: ["software developer", "softwarový inženýr", "softwarový vývojář", "software programátor", "application developer", "aplikační vývojář", "aplikační vývojář/ka", "vývojář aplikací", "vývojář/ka aplikací", "softwarový vývojář/ka"],
    must_haves: [
      mh("shipped-software", "Shipped software", "Has shipped production software at a named company or as a public product", "job history", "repo", "product page"),
      mh("public-code", "Public code", "Public repositories with tests, documentation and recent commits", "repo", "package"),
      mh("language-depth", "Language depth", "Shows depth in at least one mainstream language, such as Java, C#, Python, TypeScript or Go", "repo", "stackexchange profile", "blog post"),
      mh("engineering-practice", "Engineering practice", "Shows code review, CI or design write-ups in public work", "repo", "blog post", "talk"),
    ],
    sources: { steps: ["github_profile", "github_deep", "stackexchange_profile", "linkedin_profile", "personal_site_crawl", "talks_serp"], sites: ["github.com", "stackoverflow.com", "dev.to", "medium.com"] },
  },
  {
    key: "soc-analyst", title: "SOC Analyst", family: "engineering", profile: "credentialed",
    aliases: ["soc specialist", "soc&noc specialist", "noc specialist", "security operations analyst", "security operations engineer", "detection engineer", "threat detection engineer", "incident responder", "blue team analyst", "analytik soc", "specialista soc", "analytik bezpečnostního dohledu", "specialista bezpečnostního dohledu"],
    must_haves: [
      mh("soc-certs", "Security operations certification", "Holds a listed certification such as CompTIA Security+, CySA+, GCIA, GCIH or CCNA Security", "certification listing", "profile"),
      mh("siem-tooling", "SIEM and detection tooling", "Shows work with Splunk, Sentinel, Elastic, QRadar or Sigma rules", "repo", "job history", "blog post"),
      mh("detection-content", "Detection content", "Has published detection rules, playbooks or threat-hunting write-ups", "repo", "blog post", "talk"),
      mh("soc-experience", "SOC experience", "Has held SOC, NOC or incident response roles at named organisations", "job history", "profile"),
      mh("ctf-labs", "Lab and CTF record", "Has public results on TryHackMe, Hack The Box or CTF platforms", "ctf profile", "blog post"),
    ],
    sources: { steps: ["linkedin_profile", "github_profile", "talks_serp", "x_profile", "personal_site_crawl"], sites: ["github.com", "credly.com", "tryhackme.com", "app.hackthebox.com", "medium.com"] },
  },
  {
    key: "mechanical-design-engineer", title: "Mechanical Design Engineer", family: "engineering", profile: "credentialed",
    aliases: ["konstruktér", "konstruktér/ka", "konstruktérka", "strojní konstruktér", "konstruktér strojních zařízení", "konstruktér/ka strojních zařízení", "mechanical engineer", "strojní inženýr", "cad konstruktér", "design engineer mechanical", "strojírenský konstruktér"],
    must_haves: [
      mh("cad-tools", "CAD tooling", "Lists or shows work in SolidWorks, Inventor, CATIA, Creo or NX", "profile", "portfolio", "job history"),
      mh("delivered-machines", "Delivered machines", "Has designed machines, fixtures or products built by named manufacturers", "job history", "product page", "case study"),
      mh("engineering-degree", "Engineering degree", "Holds a mechanical engineering degree (Ing./Bc.) from a listed university", "profile", "thesis listing"),
      mh("patents-models", "Patents or utility models", "Is named on patents, utility models or published designs", "patent", "register entry"),
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "github_profile"], sites: ["linkedin.com", "grabcad.com", "patents.google.com", "theses.cz"] },
  },
];
