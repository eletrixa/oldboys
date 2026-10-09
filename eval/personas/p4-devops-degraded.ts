/**
 * Eval persona 4 (synthetic): DevOps engineer whose brief is written without the AI summary (degraded path).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/personas/p4-devops-degraded.ts
 * Deps:    eval/persona
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - The summary model call fails: the brief must say so, still link its evidence and ask templated questions
 * - Traps: 2016 evidence for a current skill (devil's advocate: outdated), an employer "contradiction" that is an
 *   alias ("Kontejnerka (formerly Plechovka)"), on-call duty nowhere in public (honest gap)
 *
 * Design constraints:
 * - Fictional person, handles `evalp-*`; truth written by hand
 */
import type { Persona } from "../persona";

const LI = "https://www.linkedin.com/in/evalp-marek-ukazkovy/";
const GH = "https://github.com/evalp-mukazkovy";
const API = "https://api.github.com/users/evalp-mukazkovy";

export const p4: Persona = {
  id: "p4-devops-degraded",
  title: "DevOps engineer in Plzeň, AI summary down: 2016 evidence, alias employer, no on-call evidence",
  role: "DevOps Engineer",
  profileUrl: LI,
  cvText: null,
  mustHaves: [
    { id: "mh-kubernetes", text: "Runs services on Kubernetes", title: "Kubernetes" },
    { id: "mh-terraform", text: "Writes infrastructure as code in Terraform", title: "Terraform" },
    { id: "mh-oncall", text: "Has on-call experience for production systems", title: "On-call" },
  ],
  recorded: {
    linkedin: {
      linkedinUrl: LI,
      firstName: "Marek",
      lastName: "Ukázkový",
      headline: "DevOps Engineer at Kontejnerka (formerly Plechovka)",
      location: "Plzeň, Czechia",
      experience: [{ position: "DevOps Engineer", companyName: "Kontejnerka", startDate: "2020", endDate: "present" }],
      education: [],
      skills: ["Kubernetes", "Terraform"],
    },
    serp: {
      serp_person: [],
      social_serp: [{ title: "evalp-mukazkovy (Marek Ukázkový) · GitHub", url: GH, description: "Terraform, Kubernetes, CI. Plzeň." }],
    },
    fetch: {
      [API]: { login: "evalp-mukazkovy", html_url: GH, name: "Marek Ukázkový", bio: "Infrastructure", company: "Plechovka", location: "Plzeň", public_repos: 2, followers: 7, created_at: "2014-01-10T00:00:00Z" },
      [`${API}/repos?sort=updated&per_page=10`]: [
        { html_url: `${GH}/helm-charts`, name: "helm-charts", description: "Helm charts for internal services on Kubernetes", language: "Shell", stargazers_count: 4, pushed_at: "2026-09-12T00:00:00Z", fork: false },
        { html_url: `${GH}/terraform-aws-modules`, name: "terraform-aws-modules", description: "Terraform modules for AWS VPC and ECS", language: "HCL", stargazers_count: 9, pushed_at: "2016-11-02T00:00:00Z", fork: false },
      ],
    },
    resolve: {
      [GH]: { score: 0.88, reasons: ["Name matches", "Location Plzeň matches"] },
    },
    extract: [
      { question_id: "current-role", text: "DevOps Engineer at Kontejnerka since 2020.", kind: "FACT", confidence: 0.95, quote: "DevOps Engineer @ Kontejnerka (2020–present)", sources: [LI] },
      { question_id: "mh-kubernetes", text: "Maintains Helm charts for services on Kubernetes.", kind: "FACT", confidence: 0.85, quote: "Helm charts for internal services on Kubernetes", sources: [`${GH}/helm-charts`] },
      { question_id: "mh-terraform", text: "Writes Terraform modules for AWS.", kind: "FACT", confidence: 0.8, quote: "Terraform modules for AWS VPC and ECS", sources: [`${GH}/terraform-aws-modules`] },
      { question_id: "contradictions", text: "LinkedIn names the employer Kontejnerka while GitHub names Plechovka.", kind: "INFERENCE", confidence: 0.6, quote: null, sources: [LI, GH] },
    ],
    verifyRejects: [],
    challenges: {
      "Writes Terraform modules for AWS.": { ground: "outdated", why: "The repository was last pushed in November 2016." },
    },
    summaryFails: "summary model unavailable (recorded 529 overloaded)",
  },
  truth: {
    profiles: [{ url: GH, person: true, note: "own GitHub" }],
    mustHaves: {
      "mh-kubernetes": { evidenced: true, keyword: "kubernetes" },
      "mh-terraform": { evidenced: false, keyword: "terraform" },
      "mh-oncall": { evidenced: false, keyword: "on-call" },
    },
    claims: [
      { text: "DevOps Engineer at Kontejnerka since 2020.", expect: "fact" },
      { text: "Maintains Helm charts for services on Kubernetes.", expect: "fact" },
      { text: "Writes Terraform modules for AWS.", expect: "to-verify", trap: "2016 evidence for a current skill" },
      { text: "LinkedIn names the employer Kontejnerka while GitHub names Plechovka.", expect: "not-in-brief", trap: "Alias shown as a contradiction" },
    ],
    gaps: ["serp_person", "stackexchange_profile"],
    degraded: true,
  },
};
