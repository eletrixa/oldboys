/**
 * Eval persona 2 (synthetic): frontend engineer in Praha with a same-name GitHub account in the same city.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/personas/p2-frontend.ts
 * Deps:    eval/persona
 * Tested:  eval/__tests__/eval.test.ts
 *
 * Key responsibilities:
 * - Traps: a namesake GitHub in the same city (the identity model scores name + city high, as its prompt allows),
 *   a hedged FACT ("probably"), a claim cited only from an unconfirmed page; the person has no GitHub of their own
 *
 * Design constraints:
 * - Fictional person, handles `evalp-*`, web pages on example.com / example.org; truth written by hand
 */
import type { Persona } from "../persona";

const LI = "https://www.linkedin.com/in/evalp-tomas-smysleny/";
const BLOG = "https://tomas-smysleny.example.com/";
const REALTOR = "https://reality-praha.example.org/makleri/tomas-smysleny";
const GH_NAMESAKE = "https://github.com/evalp-tsmysleny";
const API = "https://api.github.com/users/evalp-tsmysleny";

export const p2: Persona = {
  id: "p2-frontend",
  title: "Frontend engineer in Praha: same-name GitHub in the same city, hedged FACT, unconfirmed page",
  role: "Frontend Engineer (React)",
  profileUrl: LI,
  cvText: null,
  mustHaves: [
    { id: "mh-react", text: "Builds user interfaces in React", title: "React" },
    { id: "mh-design-system", text: "Has built or maintained a design system", title: "Design system" },
    { id: "mh-typescript", text: "Writes TypeScript", title: "TypeScript" },
  ],
  recorded: {
    linkedin: {
      linkedinUrl: LI,
      firstName: "Tomáš",
      lastName: "Smyšlený",
      headline: "Frontend Engineer at Vzorek Labs",
      location: "Praha, Czechia",
      experience: [
        { position: "Frontend Engineer", companyName: "Vzorek Labs", startDate: "2022", endDate: "present" },
        { position: "Junior Developer", companyName: "Šablona s.r.o.", startDate: "2019", endDate: "2022" },
      ],
      education: [],
      skills: ["React", "CSS"],
    },
    serp: {
      serp_person: [
        { title: "Tomáš Smyšlený – blog o Reactu", url: BLOG, description: "Píšu o Reactu a design systémech. Frontend ve Vzorek Labs." },
        { title: "Tomáš Smyšlený – realitní makléř", url: REALTOR, description: "Tomáš Smyšlený, realitní makléř, Praha 6." },
      ],
      social_serp: [{ title: "evalp-tsmysleny (Tomáš Smyšlený) · GitHub", url: GH_NAMESAKE, description: "Embedded C, firmware for heating controllers. Praha." }],
    },
    fetch: {
      [API]: { login: "evalp-tsmysleny", html_url: GH_NAMESAKE, name: "Tomáš Smyšlený", bio: "Firmware and embedded C", company: "Teplo Control", location: "Praha", public_repos: 1, followers: 3, created_at: "2015-05-01T00:00:00Z" },
      [`${API}/repos?sort=updated&per_page=10`]: [
        { html_url: `${GH_NAMESAKE}/thermo-fw`, name: "thermo-fw", description: "Firmware for heating controllers", language: "C", stargazers_count: 2, pushed_at: "2026-07-01T00:00:00Z", fork: false },
      ],
    },
    resolve: {
      [BLOG]: { score: 0.85, reasons: ["Name matches", "Employer Vzorek Labs matches"] },
      [REALTOR]: { score: 0.4, reasons: ["Name and city match", "Different profession (real estate)"] },
      [GH_NAMESAKE]: { score: 0.85, reasons: ["Name matches", "Location Praha matches"] },
    },
    extract: [
      { question_id: "current-role", text: "Frontend Engineer at Vzorek Labs since 2022.", kind: "FACT", confidence: 0.95, quote: "Frontend Engineer @ Vzorek Labs (2022–present)", sources: [LI] },
      { question_id: "mh-react", text: "Writes a blog about React and design systems.", kind: "FACT", confidence: 0.85, quote: "Píšu o Reactu a design systémech", sources: [BLOG] },
      { question_id: "mh-design-system", text: "Probably the main author of the Vzorek Labs design system.", kind: "FACT", confidence: 0.7, quote: "Frontend ve Vzorek Labs", sources: [BLOG] },
      { question_id: "public-code", text: "Writes firmware for heating controllers in C.", kind: "FACT", confidence: 0.85, quote: "Firmware for heating controllers", sources: [`${GH_NAMESAKE}/thermo-fw`] },
      { question_id: "location-match", text: "Based in Praha 6.", kind: "FACT", confidence: 0.7, quote: "Praha 6", sources: [REALTOR] },
    ],
    verifyRejects: [],
    challenges: {},
  },
  truth: {
    profiles: [
      { url: BLOG, person: true, note: "own blog" },
      { url: REALTOR, person: false, note: "real-estate agent with the same name in Praha" },
      { url: GH_NAMESAKE, person: false, note: "firmware developer with the same name in Praha" },
    ],
    mustHaves: {
      "mh-react": { evidenced: true, keyword: "react" },
      "mh-design-system": { evidenced: false, keyword: "design system" },
      "mh-typescript": { evidenced: false, keyword: "typescript" },
    },
    claims: [
      { text: "Frontend Engineer at Vzorek Labs since 2022.", expect: "fact" },
      { text: "Writes a blog about React and design systems.", expect: "fact" },
      { text: "Probably the main author of the Vzorek Labs design system.", expect: "to-verify", trap: "Hedged FACT" },
      { text: "Writes firmware for heating controllers in C.", expect: "not-in-brief", trap: "FACT from a same-city namesake's GitHub" },
      { text: "Based in Praha 6.", expect: "not-in-brief", trap: "Claim backed only by an unconfirmed page" },
    ],
    gaps: ["stackexchange_profile"],
  },
};
