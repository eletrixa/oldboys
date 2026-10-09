/**
 * Eval persona 3 (synthetic): product manager with a CV that differs from the public LinkedIn record.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/personas/p3-product-cv.ts
 * Deps:    eval/persona
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - Traps: a CV title and dates that differ from LinkedIn (must become a neutral interview question), a CV-only
 *   statement quoted as FACT from the CV itself, a course homework page presented as work evidence (devil's
 *   advocate), a same-city namesake web page, no GitHub at all (honest gap)
 *
 * Design constraints:
 * - Fictional person, handles `evalp-*`, web pages on example.com / example.org; truth written by hand
 */
import type { Persona } from "../persona";

const LI = "https://www.linkedin.com/in/evalp-petra-fiktivni/";
const COURSE = "https://productcraft.example.org/kurz/tyden-2/petra-fiktivni";
const PHOTO = "https://foto-fiktivni.example.com/";

const CV = [
  "Petra Fiktivní",
  "Senior Product Manager · Olomouc",
  "linkedin.com/in/evalp-petra-fiktivni",
  "",
  "Experience",
  "Senior Product Manager, Mapovna, 2024 – today",
  "Head of Product, Lumenfold s.r.o., 2019 – 2024",
  "Led the pricing redesign that raised conversion by 18 %.",
  "",
  "Skills: roadmapping, customer discovery, stakeholder management",
].join("\n");

export const p3: Persona = {
  id: "p3-product-cv",
  title: "Product manager with a CV: CV differs from LinkedIn, CV-only quote, course homework, no GitHub",
  role: "Senior Product Manager",
  profileUrl: LI,
  cvText: CV,
  mustHaves: [
    { id: "mh-roadmap", text: "Has owned a product roadmap", title: "Roadmap" },
    { id: "mh-discovery", text: "Has run customer discovery interviews", title: "Discovery" },
    { id: "mh-sql", text: "Can query data with SQL", title: "SQL" },
  ],
  recorded: {
    linkedin: {
      linkedinUrl: LI,
      firstName: "Petra",
      lastName: "Fiktivní",
      headline: "Senior Product Manager at Mapovna · roadmap owner for the mobile app",
      location: "Olomouc, Czechia",
      experience: [
        { position: "Senior Product Manager", companyName: "Mapovna", startDate: "2024", endDate: "present" },
        { position: "Product Manager", companyName: "Lumenfold", startDate: "2021", endDate: "2024" },
        { position: "Business Analyst", companyName: "Lumenfold", startDate: "2019", endDate: "2021" },
      ],
      education: [],
      skills: ["Roadmapping"],
    },
    cvFacts: { full_name: "Petra Fiktivní", headline: "Senior Product Manager", location: "Olomouc", current_employer: "Mapovna", links: ["linkedin.com/in/evalp-petra-fiktivni"] },
    serp: {
      serp_person: [
        { title: "Product discovery v praxi – Petra Fiktivní", url: COURSE, description: "Domácí úkol, týden 2: Petra Fiktivní (Mapovna) – discovery rozhovory se zákazníky." },
        { title: "Petra Fiktivní – fotografka Olomouc", url: PHOTO, description: "Portrétní a produktová fotografie, Olomouc." },
      ],
      social_serp: [],
    },
    fetch: {},
    resolve: {
      [COURSE]: { score: 0.7, reasons: ["Name matches", "Employer Mapovna matches"] },
      [PHOTO]: { score: 0.5, reasons: ["Name and city match", "Different profession (photography)"] },
    },
    extract: [
      { question_id: "current-role", text: "Senior Product Manager at Mapovna since 2024.", kind: "FACT", confidence: 0.95, quote: "Senior Product Manager @ Mapovna (2024–present)", sources: [LI] },
      { question_id: "mh-roadmap", text: "Owns the roadmap for the Mapovna mobile app.", kind: "FACT", confidence: 0.85, quote: "roadmap owner for the mobile app", sources: [LI] },
      { question_id: "mh-discovery", text: "Ran customer discovery interviews for Mapovna.", kind: "FACT", confidence: 0.8, quote: "discovery rozhovory se zákazníky", sources: [COURSE] },
      {
        question_id: "cv-consistency",
        text: "CV: Head of Product at Lumenfold from 2019 to 2024. Public LinkedIn: Product Manager at Lumenfold from 2021 to 2024, Business Analyst from 2019 to 2021.",
        kind: "INFERENCE",
        confidence: 0.7,
        quote: "Product Manager @ Lumenfold (2021–2024)",
        sources: [LI, "cv"],
      },
      { question_id: "cv-consistency", text: "Senior Product Manager at Mapovna since 2024, as the CV says.", kind: "FACT", confidence: 0.9, quote: "Senior Product Manager @ Mapovna (2024–present)", sources: [LI, "cv"] },
      { question_id: "cv-consistency", text: "Led the pricing redesign that raised conversion by 18 %.", kind: "FACT", confidence: 0.8, quote: "Led the pricing redesign that raised conversion by 18 %", sources: ["cv", LI] },
    ],
    verifyRejects: [],
    challenges: {
      "Ran customer discovery interviews for Mapovna.": { ground: "tutorial-or-course", why: "The page is a week 2 homework assignment of a product course." },
    },
  },
  truth: {
    profiles: [
      { url: COURSE, person: true, note: "own course homework page" },
      { url: PHOTO, person: false, note: "photographer with the same name in Olomouc" },
    ],
    mustHaves: {
      "mh-roadmap": { evidenced: true, keyword: "roadmap" },
      "mh-discovery": { evidenced: false, keyword: "discovery" },
      "mh-sql": { evidenced: false, keyword: "sql" },
    },
    claims: [
      { text: "Senior Product Manager at Mapovna since 2024.", expect: "fact" },
      { text: "Owns the roadmap for the Mapovna mobile app.", expect: "fact" },
      { text: "Senior Product Manager at Mapovna since 2024, as the CV says.", expect: "fact", cvOutcome: "matches" },
      { text: "Ran customer discovery interviews for Mapovna.", expect: "to-verify", trap: "Course homework shown as work evidence" },
      {
        text: "CV: Head of Product at Lumenfold from 2019 to 2024. Public LinkedIn: Product Manager at Lumenfold from 2021 to 2024, Business Analyst from 2019 to 2021.",
        expect: "to-verify",
        trap: "CV differs from the public record",
        cvOutcome: "differs",
      },
      { text: "Led the pricing redesign that raised conversion by 18 %.", expect: "not-fact", trap: "FACT quoted only from the CV", cvOutcome: "not-found" },
    ],
    gaps: ["github_profile", "stackexchange_profile"],
    interviewAbout: ["Head of Product"],
  },
};
