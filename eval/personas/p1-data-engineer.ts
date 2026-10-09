/**
 * Eval persona 1 (synthetic): data engineer with two namesakes, a forked repository and a quote that is not in the source.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/personas/p1-data-engineer.ts
 * Deps:    eval/persona
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - Traps: namesake LinkedIn and GitHub in another city, a FACT quoted from a forked repo, a FACT whose quote the
 *   source does not contain, a claim citing a namesake page, Stack Exchange with nothing found (honest gap)
 *
 * Design constraints:
 * - Fictional person, handles `evalp-*`, web pages on example.org; truth written by hand, never from the run
 */
import type { Persona } from "../persona";

const LI = "https://www.linkedin.com/in/evalp-alena-vymyslena/";
const LI_NAMESAKE = "https://cz.linkedin.com/in/evalp-alena-vymyslena-ostrava";
const GH = "https://github.com/evalp-avymyslena";
const GH_NAMESAKE = "https://github.com/evalp-alenav";
const TALK = "https://meetup.example.org/brno-data/2025/alena-vymyslena-pipelines";
const API = "https://api.github.com/users/evalp-avymyslena";

export const p1: Persona = {
  id: "p1-data-engineer",
  title: "Data engineer in Brno: namesakes on LinkedIn and GitHub, forked repo, quote not in source",
  role: "Senior Data Engineer",
  profileUrl: LI,
  cvText: null,
  mustHaves: [
    { id: "mh-python", text: "Writes production Python", title: "Python" },
    { id: "mh-airflow", text: "Has built pipelines with Apache Airflow", title: "Airflow" },
    { id: "mh-kubernetes", text: "Has run workloads on Kubernetes", title: "Kubernetes" },
  ],
  recorded: {
    linkedin: {
      linkedinUrl: LI,
      firstName: "Alena",
      lastName: "Vymyšlená",
      headline: "Senior Data Engineer at Datamlýn",
      location: "Brno, Czechia",
      experience: [
        { position: "Senior Data Engineer", companyName: "Datamlýn", startDate: "2021", endDate: "present" },
        { position: "Data Engineer", companyName: "Kódovna Brno", startDate: "2017", endDate: "2021" },
      ],
      education: [{ schoolName: "Example University of Technology", degree: "MSc", fieldOfStudy: "Computer Science" }],
      skills: ["Python", "SQL", "Airflow"],
    },
    serp: {
      serp_person: [
        { title: "Alena Vymyšlená - Senior Data Engineer - Datamlýn | LinkedIn", url: "https://cz.linkedin.com/in/evalp-alena-vymyslena", description: "Senior Data Engineer at Datamlýn · Brno" },
        { title: "Alena Vymyšlená - Účetní - Účetnictví Ostrava s.r.o. | LinkedIn", url: LI_NAMESAKE, description: "Účetní · Ostrava" },
        { title: "Orchestrating batch pipelines — Alena Vymyšlená", url: TALK, description: "Alena Vymyšlená (Datamlýn) on Airflow at Brno Data Meetup, March 2025." },
      ],
      social_serp: [
        { title: "evalp-avymyslena (Alena Vymyšlená) · GitHub", url: GH, description: "Data pipelines, Airflow, dbt. Brno." },
        { title: "Alena Vymyšlená (evalp-alenav) · GitHub", url: GH_NAMESAKE, description: "Excel macros and VBA. Ostrava." },
      ],
    },
    fetch: {
      [API]: { login: "evalp-avymyslena", html_url: GH, name: "Alena Vymyšlená", bio: "Data engineer. Pipelines and tests.", company: "Datamlýn", location: "Brno", public_repos: 2, followers: 12, created_at: "2018-03-01T00:00:00Z" },
      [`${API}/repos?sort=updated&per_page=10`]: [
        { html_url: `${GH}/airflow-dags-retail`, name: "airflow-dags-retail", description: "Airflow DAGs and dbt models for a retail demo warehouse", language: "Python", stargazers_count: 14, pushed_at: "2026-08-20T10:00:00Z", fork: false },
        { html_url: `${GH}/k8s-operator`, name: "k8s-operator", description: "Kubernetes operator for Spark jobs", language: "Go", stargazers_count: 0, pushed_at: "2024-02-01T00:00:00Z", fork: true },
      ],
    },
    resolve: {
      [LI_NAMESAKE]: { score: 0.15, reasons: ["Name matches", "Different city (Ostrava) and field (accounting)"] },
      [TALK]: { score: 0.75, reasons: ["Name matches", "Employer Datamlýn matches"] },
      [GH]: { score: 0.9, reasons: ["Name matches", "Location Brno matches", "Data pipelines"] },
      [GH_NAMESAKE]: { score: 0.35, reasons: ["Name matches", "Different city (Ostrava)"] },
    },
    extract: [
      { question_id: "current-role", text: "Senior Data Engineer at Datamlýn since 2021.", kind: "FACT", confidence: 0.95, quote: "Senior Data Engineer @ Datamlýn (2021–present)", sources: [LI] },
      { question_id: "mh-python", text: "Maintains a public Python repository with Airflow DAGs and dbt models.", kind: "FACT", confidence: 0.85, quote: "Airflow DAGs and dbt models for a retail demo warehouse", sources: [`${GH}/airflow-dags-retail`] },
      { question_id: "mh-airflow", text: "Spoke about Airflow at Brno Data Meetup in March 2025.", kind: "FACT", confidence: 0.85, quote: "on Airflow at Brno Data Meetup, March 2025", sources: [TALK] },
      { question_id: "mh-kubernetes", text: "Built a Kubernetes operator for Spark jobs.", kind: "FACT", confidence: 0.8, quote: "Kubernetes operator for Spark jobs", sources: [`${GH}/k8s-operator`] },
      { question_id: "career-history", text: "Led a team of 12 data engineers at Kódovna Brno.", kind: "FACT", confidence: 0.8, quote: "Led a team of 12 data engineers", sources: [LI] },
      { question_id: "career-history", text: "Works as an accountant in Ostrava.", kind: "FACT", confidence: 0.7, quote: "Účetní · Ostrava", sources: [LI_NAMESAKE] },
    ],
    verifyRejects: [],
    challenges: {},
  },
  truth: {
    profiles: [
      { url: LI_NAMESAKE, person: false, note: "LinkedIn accountant in Ostrava" },
      { url: GH_NAMESAKE, person: false, note: "GitHub account in Ostrava" },
      { url: GH, person: true, note: "own GitHub" },
      { url: TALK, person: true, note: "own meetup talk page" },
    ],
    mustHaves: {
      "mh-python": { evidenced: true, keyword: "python" },
      "mh-airflow": { evidenced: true, keyword: "airflow" },
      "mh-kubernetes": { evidenced: false, keyword: "kubernetes" },
    },
    claims: [
      { text: "Senior Data Engineer at Datamlýn since 2021.", expect: "fact" },
      { text: "Maintains a public Python repository with Airflow DAGs and dbt models.", expect: "fact" },
      { text: "Spoke about Airflow at Brno Data Meetup in March 2025.", expect: "fact" },
      { text: "Built a Kubernetes operator for Spark jobs.", expect: "to-verify", trap: "Forked repository" },
      { text: "Led a team of 12 data engineers at Kódovna Brno.", expect: "to-verify", trap: "Quote not in the source" },
      { text: "Works as an accountant in Ostrava.", expect: "not-in-brief", trap: "Claim from a namesake's page" },
    ],
    gaps: ["stackexchange_profile"],
  },
};
