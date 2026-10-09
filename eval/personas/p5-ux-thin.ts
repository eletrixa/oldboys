/**
 * Eval persona 5 (synthetic): UX researcher with a thin public footprint and a same-field namesake in another city.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/personas/p5-ux-thin.ts
 * Deps:    eval/persona
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - Traps: a FACT that adds a number its quote does not state (only the second model can catch it), a same-field
 *   namesake LinkedIn in Praha and a claim taken from it, two must-haves nothing public speaks to, no GitHub
 *
 * Design constraints:
 * - Fictional person, handles `evalp-*`, web pages on example.com; truth written by hand
 */
import type { Persona } from "../persona";

const LI = "https://www.linkedin.com/in/evalp-lucie-testovaci/";
const LI_NAMESAKE = "https://cz.linkedin.com/in/evalp-lucie-testovaci-praha";
const TEAM = "https://hnizdo-studio.example.com/tym/lucie-testovaci";

export const p5: Persona = {
  id: "p5-ux-thin",
  title: "UX researcher in Liberec, thin footprint: overstated number, same-field namesake, two open must-haves",
  role: "UX Researcher",
  profileUrl: LI,
  cvText: null,
  mustHaves: [
    { id: "mh-usability", text: "Has run usability studies", title: "Usability testing" },
    { id: "mh-survey", text: "Has designed quantitative surveys", title: "Surveys" },
    { id: "mh-figma", text: "Prototypes in Figma", title: "Figma" },
  ],
  recorded: {
    linkedin: {
      linkedinUrl: LI,
      firstName: "Lucie",
      lastName: "Testovací",
      headline: "UX Researcher at Hnízdo Studio",
      location: "Liberec, Czechia",
      experience: [
        { position: "UX Researcher", companyName: "Hnízdo Studio", startDate: "2023", endDate: "present" },
        { position: "Research Assistant", companyName: "Example University", startDate: "2021", endDate: "2023" },
      ],
      education: [],
      skills: [],
    },
    serp: {
      serp_person: [
        { title: "Lucie Testovací | Hnízdo Studio", url: TEAM, description: "Lucie Testovací vede uživatelský výzkum. Ran usability studies for the e-shop redesign." },
        { title: "Lucie Testovací - UX Designer - Grafika Praha | LinkedIn", url: LI_NAMESAKE, description: "UX Designer at Grafika Praha · Praha" },
      ],
      social_serp: [],
    },
    fetch: {},
    resolve: {
      [TEAM]: { score: 0.8, reasons: ["Name matches", "Employer Hnízdo Studio matches"] },
      [LI_NAMESAKE]: { score: 0.7, reasons: ["Name matches", "Same field (UX)"] },
    },
    extract: [
      { question_id: "current-role", text: "UX Researcher at Hnízdo Studio since 2023.", kind: "FACT", confidence: 0.95, quote: "UX Researcher @ Hnízdo Studio (2023–present)", sources: [LI] },
      { question_id: "mh-usability", text: "Ran 40 usability studies for the e-shop redesign.", kind: "FACT", confidence: 0.8, quote: "Ran usability studies for the e-shop redesign", sources: [TEAM] },
      { question_id: "mh-figma", text: "UX Designer at Grafika Praha.", kind: "FACT", confidence: 0.7, quote: "UX Designer at Grafika Praha", sources: [LI_NAMESAKE] },
    ],
    verifyRejects: ["Ran 40 usability studies for the e-shop redesign."],
    challenges: {},
  },
  truth: {
    profiles: [
      { url: TEAM, person: true, note: "own team page at the employer" },
      { url: LI_NAMESAKE, person: false, note: "UX designer with the same name in Praha" },
    ],
    mustHaves: {
      // The team page does say "Ran usability studies": the evidence exists, only the claim overstated it
      "mh-usability": { evidenced: true, keyword: "usability" },
      "mh-survey": { evidenced: false, keyword: "survey" },
      "mh-figma": { evidenced: false, keyword: "figma" },
    },
    claims: [
      { text: "UX Researcher at Hnízdo Studio since 2023.", expect: "fact" },
      { text: "Ran 40 usability studies for the e-shop redesign.", expect: "to-verify", trap: "FACT adds a number the quote does not state" },
      { text: "UX Designer at Grafika Praha.", expect: "not-in-brief", trap: "Claim from a same-field namesake's LinkedIn" },
    ],
    gaps: ["github_profile", "stackexchange_profile"],
  },
};
