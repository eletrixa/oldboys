/**
 * Role catalog: design family templates (product, UX, UI, research, writing, brand, motion, 3D, art direction).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/role-catalog/design.ts
 * Deps:    src/domain/role-catalog/types (RoleTemplate)
 * Tested:  src/domain/__tests__/role-catalog.test.ts (through the catalog)
 *
 * Key responsibilities:
 * - `DESIGN`: preselected design roles with EN/CZ aliases, observable must-haves and a public evidence plan
 *
 * Design constraints:
 * - Relative imports only (plain Node loads the catalog)
 * - Must-haves are observable from public web evidence; never health, politics, religion, ethnicity,
 *   sexuality, age, family, personality, culture fit or trustworthiness
 */
import type { RoleTemplate } from "./types";

export const DESIGN: RoleTemplate[] = [
  {
    key: "product-designer",
    title: "Product Designer",
    family: "design",
    aliases: ["produktový designér", "produktový designer", "product design", "ux/ui designer", "digital product designer"],
    profile: "makers",
    must_haves: [
      { id: "mh-shipped-product-ui", title: "Shipped product UI", text: "Has a public portfolio with shipped product UI case studies", accepted_evidence: ["portfolio", "case study", "Dribbble shot"] },
      { id: "mh-process-shown", title: "Design process shown", text: "Case studies show problem, research, iterations and measured outcome", accepted_evidence: ["case study", "portfolio", "published article"] },
      { id: "mh-product-company", title: "Product company experience", text: "Has worked on a live digital product at a named company", accepted_evidence: ["job history", "case study", "portfolio"] },
      { id: "mh-figma-craft", title: "Prototyping craft", text: "Publishes Figma files, prototypes or interaction demos", accepted_evidence: ["Figma community file", "portfolio", "Dribbble shot"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "instagram_profile", "talks_serp", "youtube_channel"], sites: ["dribbble.com", "behance.net", "figma.com", "medium.com", "linkedin.com"] },
  },
  {
    key: "ux-designer",
    title: "UX Designer",
    family: "design",
    aliases: ["ux designér", "user experience designer", "interaction designer", "uživatelská zkušenost", "ux"],
    profile: "makers",
    must_haves: [
      { id: "mh-ux-case-studies", title: "UX case studies", text: "Has public case studies covering flows, wireframes and usability outcomes", accepted_evidence: ["case study", "portfolio", "published article"] },
      { id: "mh-research-methods", title: "Research methods used", text: "Case studies name user research or usability testing methods used", accepted_evidence: ["case study", "portfolio", "talk"] },
      { id: "mh-information-architecture", title: "Information architecture work", text: "Shows sitemaps, user flows or IA work on a real product", accepted_evidence: ["portfolio", "case study", "Behance project"] },
      { id: "mh-ux-community", title: "Public UX contribution", text: "Has published articles or talks on UX practice", accepted_evidence: ["published article", "talk", "channel"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "talks_serp", "youtube_channel", "x_profile"], sites: ["behance.net", "medium.com", "figma.com", "linkedin.com", "czechdesign.cz"] },
  },
  {
    key: "ui-designer",
    title: "UI Designer",
    family: "design",
    aliases: ["ui designér", "user interface designer", "visual designer", "vizuální designér", "ui"],
    profile: "makers",
    must_haves: [
      { id: "mh-ui-portfolio", title: "Interface portfolio", text: "Has a public portfolio of polished interface designs", accepted_evidence: ["portfolio", "Dribbble shot", "Behance project"] },
      { id: "mh-design-system-use", title: "Component system work", text: "Shows work built on a component library or design system", accepted_evidence: ["case study", "Figma community file", "portfolio"] },
      { id: "mh-typography-layout", title: "Typography and layout", text: "Portfolio demonstrates typography, grid and colour decisions with rationale", accepted_evidence: ["case study", "Dribbble shot", "portfolio"] },
      { id: "mh-live-ui", title: "Live shipped interfaces", text: "At least one shown interface is live in a public product", accepted_evidence: ["case study", "job history", "portfolio"] },
    ],
    sources: { steps: ["personal_site_crawl", "instagram_profile", "linkedin_profile", "youtube_channel", "x_profile"], sites: ["dribbble.com", "behance.net", "figma.com", "awwwards.com", "linkedin.com"] },
  },
  {
    key: "ux-researcher",
    title: "UX Researcher",
    family: "design",
    aliases: ["ux výzkumník", "user researcher", "design researcher", "výzkumník uživatelů", "uxr"],
    profile: "makers",
    must_haves: [
      { id: "mh-research-studies", title: "Documented research studies", text: "Has public write-ups of user research studies with method and findings", accepted_evidence: ["case study", "published article", "portfolio"] },
      { id: "mh-mixed-methods", title: "Qualitative and quantitative", text: "Public work names both qualitative and quantitative methods", accepted_evidence: ["case study", "talk", "published article"] },
      { id: "mh-research-impact", title: "Research changed product", text: "Describes a product decision that changed because of their research", accepted_evidence: ["case study", "talk", "job history"] },
      { id: "mh-research-community", title: "Research community output", text: "Has talks, articles or workshops on research practice", accepted_evidence: ["talk", "published article", "channel"] },
    ],
    sources: { steps: ["linkedin_profile", "personal_site_crawl", "talks_serp", "openalex_author", "youtube_channel"], sites: ["medium.com", "linkedin.com", "researchgate.net", "czechdesign.cz"] },
  },
  {
    key: "ux-writer",
    title: "UX Writer",
    family: "design",
    aliases: ["content designer", "ux copywriter", "microcopy writer", "ux textař", "obsahový designér"],
    profile: "makers",
    must_haves: [
      { id: "mh-interface-copy", title: "Interface copy samples", text: "Has public samples of in-product copy, microcopy or error messages", accepted_evidence: ["portfolio", "case study", "published article"] },
      { id: "mh-content-system", title: "Content guidelines work", text: "Shows a voice and tone guide, content pattern library or style guide", accepted_evidence: ["case study", "portfolio", "published article"] },
      { id: "mh-writing-outcome", title: "Measured copy impact", text: "Case study links copy changes to a usability or conversion result", accepted_evidence: ["case study", "talk", "portfolio"] },
      { id: "mh-writing-public", title: "Public writing", text: "Publishes articles or talks on UX writing or content design", accepted_evidence: ["published article", "talk", "channel"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "talks_serp", "x_profile", "youtube_channel"], sites: ["medium.com", "linkedin.com", "substack.com", "czechdesign.cz"] },
  },
  {
    key: "graphic-designer",
    title: "Graphic Designer",
    family: "design",
    aliases: ["grafik", "grafický designér", "grafická designérka", "dtp operátor", "visual communication designer"],
    profile: "makers",
    must_haves: [
      { id: "mh-print-digital-work", title: "Visual portfolio", text: "Has a public portfolio of print or digital graphic work for named clients", accepted_evidence: ["portfolio", "Behance project", "Instagram portfolio"] },
      { id: "mh-layout-typography", title: "Layout and typography", text: "Portfolio shows editorial, poster or packaging layouts with clear typography", accepted_evidence: ["portfolio", "Behance project", "case study"] },
      { id: "mh-client-projects", title: "Client project history", text: "Work history names agencies, studios or clients served", accepted_evidence: ["job history", "portfolio", "case study"] },
      { id: "mh-recognition", title: "Design recognition", text: "Has a published award, feature or competition entry", accepted_evidence: ["award", "published article", "ranking article"] },
    ],
    sources: { steps: ["personal_site_crawl", "instagram_profile", "linkedin_profile", "youtube_channel", "talks_serp"], sites: ["behance.net", "dribbble.com", "instagram.com", "czechdesign.cz", "linkedin.com"] },
  },
  {
    key: "brand-designer",
    title: "Brand Designer",
    family: "design",
    aliases: ["brand designér", "identity designer", "designér značky", "vizuální identita", "brand identity designer"],
    profile: "makers",
    must_haves: [
      { id: "mh-identity-projects", title: "Brand identity projects", text: "Has public brand identity case studies with logo, system and applications", accepted_evidence: ["case study", "Behance project", "portfolio"] },
      { id: "mh-brand-guidelines", title: "Guidelines delivered", text: "Shows brand guidelines or a multi-touchpoint identity system", accepted_evidence: ["case study", "Behance project", "portfolio"] },
      { id: "mh-strategy-link", title: "Strategy behind identity", text: "Case studies explain positioning or audience behind the identity", accepted_evidence: ["case study", "published article", "talk"] },
      { id: "mh-brand-recognition", title: "Recognised identity work", text: "Has an award or feature for a brand identity project", accepted_evidence: ["award", "published article", "ranking article"] },
    ],
    sources: { steps: ["personal_site_crawl", "instagram_profile", "linkedin_profile", "talks_serp", "youtube_channel"], sites: ["behance.net", "dribbble.com", "brandingmag.com", "czechdesign.cz", "linkedin.com"] },
  },
  {
    key: "motion-designer",
    title: "Motion Designer",
    family: "design",
    aliases: ["motion grafik", "motion designér", "motion graphics artist", "animátor", "after effects artist"],
    profile: "makers",
    must_haves: [
      { id: "mh-motion-reel", title: "Public motion reel", text: "Has a public showreel or motion projects on a video or portfolio site", accepted_evidence: ["showreel", "Vimeo project", "portfolio"] },
      { id: "mh-commercial-motion", title: "Commercial motion work", text: "Reel includes motion work for named brands, products or broadcasts", accepted_evidence: ["showreel", "case study", "job history"] },
      { id: "mh-tools-named", title: "Toolchain visible", text: "Project credits or write-ups name the motion tools and techniques used", accepted_evidence: ["case study", "portfolio", "Behance project"] },
      { id: "mh-motion-recognition", title: "Motion recognition", text: "Has a festival selection, award or staff-pick feature", accepted_evidence: ["award", "Vimeo staff pick", "published article"] },
    ],
    sources: { steps: ["personal_site_crawl", "youtube_channel", "instagram_profile", "linkedin_profile", "talks_serp"], sites: ["vimeo.com", "behance.net", "youtube.com", "dribbble.com", "instagram.com"] },
  },
  {
    key: "3d-artist",
    title: "3D Artist",
    family: "design",
    aliases: ["3d grafik", "3d umělec", "3d modeler", "3d modelář", "3d designer", "cgi artist"],
    profile: "makers",
    must_haves: [
      { id: "mh-3d-portfolio", title: "3D portfolio", text: "Has a public 3D portfolio with renders, models or scenes", accepted_evidence: ["portfolio", "ArtStation project", "Sketchfab model"] },
      { id: "mh-production-work", title: "Production credits", text: "Work history or credits show 3D work on a shipped project", accepted_evidence: ["job history", "credits", "case study"] },
      { id: "mh-breakdown", title: "Technical breakdowns", text: "Publishes wireframes, breakdowns or process steps for 3D pieces", accepted_evidence: ["ArtStation project", "case study", "video"] },
      { id: "mh-3d-recognition", title: "Community recognition", text: "Has a platform feature, challenge placement or award for 3D work", accepted_evidence: ["award", "ArtStation feature", "published article"] },
    ],
    sources: { steps: ["personal_site_crawl", "instagram_profile", "youtube_channel", "linkedin_profile", "x_profile"], sites: ["artstation.com", "behance.net", "sketchfab.com", "vimeo.com", "instagram.com"] },
  },
  {
    key: "illustrator",
    title: "Illustrator",
    family: "design",
    aliases: ["ilustrátor", "ilustrátorka", "kreslíř", "digital illustrator", "editorial illustrator"],
    profile: "makers",
    must_haves: [
      { id: "mh-illustration-portfolio", title: "Illustration portfolio", text: "Has a public illustration portfolio with a consistent body of work", accepted_evidence: ["portfolio", "Behance project", "Instagram portfolio"] },
      { id: "mh-published-illustration", title: "Published commissions", text: "Illustrations appear in a named publication, book, brand or product", accepted_evidence: ["published work", "client page", "case study"] },
      { id: "mh-style-range", title: "Range of briefs", text: "Portfolio covers more than one commissioned brief or format", accepted_evidence: ["portfolio", "Behance project", "case study"] },
      { id: "mh-illustration-recognition", title: "Illustration recognition", text: "Has an award, exhibition or competition feature", accepted_evidence: ["award", "exhibition", "published article"] },
    ],
    sources: { steps: ["personal_site_crawl", "instagram_profile", "youtube_channel", "linkedin_profile", "x_profile"], sites: ["behance.net", "instagram.com", "dribbble.com", "artstation.com", "czechdesign.cz"] },
  },
  {
    key: "head-of-design",
    title: "Head of Design",
    family: "design",
    aliases: ["design lead", "vedoucí designu", "design director", "ředitel designu", "lead designer", "hod"],
    profile: "track-record",
    must_haves: [
      { id: "mh-led-design-team", title: "Led a design team", text: "Held a named design lead or head role at a company with a design team", accepted_evidence: ["job history", "company page", "talk"] },
      { id: "mh-shipped-under-lead", title: "Product shipped under lead", text: "Public record of a product or redesign delivered while leading design", accepted_evidence: ["case study", "published article", "press"] },
      { id: "mh-design-leadership-voice", title: "Design leadership voice", text: "Has talks, interviews or articles on design leadership or practice", accepted_evidence: ["talk", "podcast", "published article"] },
      { id: "mh-design-recognition-lead", title: "Recognised design work", text: "Led work that received an award or press coverage", accepted_evidence: ["award", "press", "ranking article"] },
    ],
    sources: { steps: ["linkedin_profile", "talks_serp", "personal_site_crawl", "youtube_channel", "x_profile"], sites: ["linkedin.com", "medium.com", "czechdesign.cz", "youtube.com"] },
  },
  {
    key: "design-systems-designer",
    title: "Design Systems Designer",
    family: "design",
    aliases: ["design system designer", "design systems lead", "designér design systému", "design ops", "design system specialist"],
    profile: "makers",
    must_haves: [
      { id: "mh-system-built", title: "Built a design system", text: "Has a public case study or live site of a design system they built or scaled", accepted_evidence: ["case study", "design system site", "Figma community file"] },
      { id: "mh-tokens-components", title: "Tokens and components", text: "Public work shows design tokens, component specs or documentation", accepted_evidence: ["Figma community file", "design system site", "case study"] },
      { id: "mh-dev-collaboration", title: "Design-dev collaboration", text: "Describes collaboration with engineers on shipped components", accepted_evidence: ["case study", "talk", "published article"] },
      { id: "mh-systems-community", title: "Systems community output", text: "Has talks or articles about design systems practice", accepted_evidence: ["talk", "published article", "channel"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "github_profile", "talks_serp", "x_profile"], sites: ["figma.com", "medium.com", "github.com", "linkedin.com", "czechdesign.cz"] },
  },
  {
    key: "web-designer",
    title: "Web Designer",
    family: "design",
    aliases: ["webdesigner", "webdesignér", "tvůrce webů", "website designer", "webdesign"],
    profile: "makers",
    must_haves: [
      { id: "mh-live-sites", title: "Live websites designed", text: "Has live websites credited to them or shown in a public portfolio", accepted_evidence: ["portfolio", "live site", "case study"] },
      { id: "mh-responsive-craft", title: "Responsive craft", text: "Delivered sites work on mobile and desktop and are verifiable in public", accepted_evidence: ["live site", "portfolio", "case study"] },
      { id: "mh-platform-skills", title: "Named platforms", text: "Portfolio names the CMS or site builder used, e.g. Webflow or WordPress", accepted_evidence: ["portfolio", "case study", "job history"] },
      { id: "mh-web-recognition", title: "Web recognition", text: "Has a gallery feature or award for a website design", accepted_evidence: ["award", "Awwwards entry", "published article"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "instagram_profile", "youtube_channel", "github_profile"], sites: ["awwwards.com", "behance.net", "dribbble.com", "webflow.com", "linkedin.com"] },
  },
  {
    key: "art-director",
    title: "Art Director",
    family: "design",
    aliases: ["artdirector", "kreativní ředitel", "artdirektor", "vizuální ředitel", "ad"],
    profile: "track-record",
    must_haves: [
      { id: "mh-directed-campaigns", title: "Directed campaigns", text: "Credited as art director on named campaigns or productions", accepted_evidence: ["campaign", "credits", "case study"] },
      { id: "mh-agency-or-studio", title: "Agency or studio role", text: "Held an art director role at a named agency, studio or in-house team", accepted_evidence: ["job history", "company page", "portfolio"] },
      { id: "mh-creative-recognition", title: "Creative recognition", text: "Credited on an award-winning or press-covered creative work", accepted_evidence: ["award", "press", "ranking article"] },
      { id: "mh-visual-portfolio", title: "Visual portfolio", text: "Maintains a public portfolio of art direction work", accepted_evidence: ["portfolio", "Behance project", "showreel"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "instagram_profile", "talks_serp", "youtube_channel"], sites: ["adsoftheworld.com", "behance.net", "lovebrands.cz", "linkedin.com", "vimeo.com"] },
  },
  {
    key: "game-artist",
    title: "Game Artist",
    family: "design",
    aliases: ["herní grafik", "herní umělec", "game designer artist", "concept artist", "environment artist"],
    profile: "makers",
    must_haves: [
      { id: "mh-game-portfolio", title: "Game art portfolio", text: "Has a public portfolio of game art such as concepts, models or environments", accepted_evidence: ["portfolio", "ArtStation project", "case study"] },
      { id: "mh-shipped-game", title: "Shipped game credits", text: "Credited on at least one released game", accepted_evidence: ["credits", "MobyGames entry", "job history"] },
      { id: "mh-pipeline-knowledge", title: "Engine and pipeline", text: "Portfolio names engines or tools such as Unreal, Unity or Blender", accepted_evidence: ["ArtStation project", "case study", "portfolio"] },
      { id: "mh-game-community", title: "Community presence", text: "Shares work-in-progress or breakdowns on a public channel", accepted_evidence: ["channel", "ArtStation project", "video"] },
    ],
    sources: { steps: ["personal_site_crawl", "linkedin_profile", "youtube_channel", "instagram_profile", "x_profile", "talks_serp"], sites: ["artstation.com", "mobygames.com", "sketchfab.com", "itch.io", "linkedin.com"] },
  },
];
