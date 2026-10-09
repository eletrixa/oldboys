/**
 * Guide content: the plain-words text of /guide for a first-time, non-technical recruiter, as typed data.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/guide/guide-content.ts
 * Deps:    src/domain/audit (RETENTION_DAYS), src/domain/run-status (START_PER_HOUR_CAP, STALLED_AFTER_MINUTES)
 * Tested:  src/app/guide/__tests__/guide-content.test.ts
 *
 * Key responsibilities:
 * - Header, what you need, five steps, the identity question example, glossary, "Radar never" list, troubleshooting
 * - Rich text as segments: a `{ label }` segment is an exact UI label (rendered bold); the test checks it still exists in src/app
 *
 * Design constraints:
 * - No React; numbers come from the domain constants, "6 to 12 minutes" is written as in src/app/start-form.tsx
 * - Words describe the research, never the person: no scores, no ranking, no verdicts, nothing about personality
 * - A templated label (a number inside it) carries `literal: false` so the drift check skips it
 */
import { RETENTION_DAYS } from "@/domain/audit";
import { START_PER_HOUR_CAP, STALLED_AFTER_MINUTES } from "@/domain/run-status";

/** A plain string, or an exact UI label shown bold; `literal: false` marks a label with a changing number in it. */
export type Seg = string | { readonly label: string; readonly literal?: false };
export type Rich = readonly Seg[];

const L = (label: string): { readonly label: string } => ({ label });

export const HEADER = {
  eyebrow: "Guide",
  title: "Your first brief, step by step",
  lead: "Radar helps you prepare for an interview. You give it the position and the candidate. It reads public professional work and gives you one brief, with a source behind every point. A person makes every decision.",
  meta: "A 3-minute read. No technical knowledge needed.",
} as const;

export const BEFORE: { readonly title: string; readonly items: readonly Rich[] } = {
  title: "Before you start",
  items: [
    ["The position. Pick it from the list of roles, or paste a link to the job posting."],
    ["The candidate. Their LinkedIn profile, or their CV as text or a file."],
    ["About 6 to 12 minutes. You can close the page while Radar works."],
    ["Nothing to write for the candidate. Radar gives you a ready notice to send them."],
  ],
};

/** The identity question as the run page asks it; Jana is a made-up example. */
export const QUESTION = {
  key: "Example question",
  text: "Quick question: is this LinkedIn profile also Jana?",
  answers: [L("Yes, it's them"), L("No"), L("I'm not sure")],
} as const;

export type Step = { readonly id: string; readonly title: string; readonly body: readonly Rich[]; readonly question?: true };

export const STEPS: readonly Step[] = [
  {
    id: "step-position",
    title: "Pick the position",
    body: [
      ["Click ", L("New brief"), ". Under ", L("Position"), ", use ", L("Find a position"), " to pick one your team already has. You can also use ", L("Or create one from the role catalog"), ", or ", L("From a posting"), " and paste the job link."],
      ["Each position has must-haves: the few things the job really needs. You can change them with ", L("Edit must-haves on the position"), "."],
    ],
  },
  {
    id: "step-candidate",
    title: "Add the candidate",
    body: [
      ["Choose ", L("LinkedIn"), ", ", L("Paste CV"), " or ", L("CV file"), ". To add more people for the same position, click ", L("Add another candidate"), "."],
      ["Then click ", { label: "Research 1 candidate", literal: false }, ". The number follows how many people you add."],
      ["On your first visit, the welcome page has a shorter form: ", L("Role you are hiring for"), ", then the candidate, then ", L("Create brief"), "."],
    ],
  },
  {
    id: "step-wait",
    title: "Wait, and answer one question if asked",
    question: true,
    body: [
      ["Radar now reads public professional sources. You can leave; the brief waits in ", L("My briefs"), "."],
      ["Sometimes Radar finds a profile with the same name and asks if it is the same person. Answer only if you know. ", L("I'm not sure"), " is fine: Radar then never quotes that profile as a fact."],
      [`If nothing moves for ${String(STALLED_AFTER_MINUTES)} minutes, start it again from the position or from `, L("My briefs"), "."],
    ],
  },
  {
    id: "read",
    title: "Read the brief",
    body: [
      ["Read ", L("In 30 seconds"), " first, then ", L("Before the interview"), ". These two parts show what matters and what to check."],
      ["Below them are four tabs: ", L("Interview plan"), ", ", L("Evidence"), ", ", L("Phone screen"), " and ", L("Sources and gaps"), "."],
      ["Click ", L("Show evidence"), " next to a point to see the exact quote and where it comes from."],
    ],
  },
  {
    id: "step-use",
    title: "Use it, then let it go",
    body: [
      ["In ", L("Interview kit"), ", click ", L("Copy interview kit"), " to paste your questions anywhere, or ", L("Add interview to calendar"), "."],
      ["Under ", L("More exports"), " you find ", L("Copy for ATS"), " (for your hiring system), ", L("Copy reference questions"), " and ", L("Copy candidate notice"), "."],
      ["Send the notice to the candidate. It tells them what was looked at and how to object."],
      [`Everything is deleted after ${String(RETENTION_DAYS)} days, or sooner with `, L("Delete candidate data"), "."],
    ],
  },
];

export const WORDS: readonly { readonly term: string; readonly text: Rich }[] = [
  { term: "Brief", text: ["One page about one candidate for one position. Every point links to its source."] },
  { term: "Position", text: ["The job you are hiring for. The welcome page calls it the role."] },
  { term: "Must-have", text: ["Something the position really needs. Radar looks for public evidence of each one."] },
  { term: "Evidence", text: ["A public source that backs up a point, with the exact quote."] },
  { term: "Fact", text: ["A source says it. Radar found the quote in that source."] },
  { term: "Inference", text: ["Radar's reading of several sources, with no direct quote. Check it yourself."] },
  { term: "Statement", text: ["Something the candidate said, for example in the phone screen. It is not public evidence."] },
  { term: "Strong, Some or Thin evidence", text: ["How much public evidence the research found for a part of the brief. It is about the research, not the person."] },
  { term: "Gap", text: ["Nothing public was found for a point. That is normal for many people and says nothing about them. Ask about it in the interview."] },
  { term: "Not searched", text: ["A source Radar did not use, with the reason, for example that it needs a login."] },
  { term: "Possibly the same person", text: ["A profile with the same name that nobody confirmed. Radar never uses it as a fact."] },
  {
    term: "Fit",
    text: ["The column in ", L("My briefs"), ": the share of the position's must-haves for which the research found public evidence, with a partial match counted as half. It shows what is public, not how good the person is."],
  },
  {
    term: "Confidence in this brief",
    text: ["A box in the brief that shows how far you can rely on it: how many points are checked facts, how the profile was confirmed as theirs and which checks ran. It is about the brief, never the person."],
  },
];

export const NEVER: { readonly title: string; readonly items: readonly string[] } = {
  title: "Radar never",
  items: [
    "scores or ranks people, or decides for you",
    "reads private accounts or closed groups",
    "matches faces",
    "uses health, religion, politics, union membership, sexual orientation or ethnic origin",
    `keeps the data longer than ${String(RETENTION_DAYS)} days`,
  ],
};

export const HELP: readonly { readonly q: string; readonly a: Rich }[] = [
  { q: "The candidate has no LinkedIn", a: ["Use ", L("Paste CV"), " or ", L("CV file"), "."] },
  { q: "You do not know if a profile is theirs", a: ["Click ", L("I'm not sure"), ". Radar keeps that profile out of the facts."] },
  {
    q: "It takes a long time",
    a: ["Leave the page; the brief waits in ", L("My briefs"), `. If nothing moves for ${String(STALLED_AFTER_MINUTES)} minutes, start it again.`],
  },
  {
    q: "You cannot start a brief",
    a: [`Each company can start ${String(START_PER_HOUR_CAP)} briefs per hour. The form keeps what you entered. Try again later.`],
  },
  { q: "The brief has few facts", a: ["That is normal for many jobs, where little work is public. Use the gaps as interview questions."] },
  { q: "The candidate asks what you did", a: ["Send them the notice: ", L("Copy candidate notice"), " under ", L("More exports"), "."] },
];

/** Every string the page shows, flattened (labels included); the wording test reads this. */
export function allText(): string[] {
  const rich = (r: Rich): string[] => r.map((s) => (typeof s === "string" ? s : s.label));
  return [
    ...Object.values(HEADER),
    BEFORE.title,
    ...BEFORE.items.flatMap(rich),
    QUESTION.key,
    QUESTION.text,
    ...rich(QUESTION.answers),
    ...STEPS.flatMap((s) => [s.title, ...s.body.flatMap(rich)]),
    ...WORDS.flatMap((w) => [w.term, ...rich(w.text)]),
    // Each item reads as one sentence after its title ("Radar never scores or ranks people").
    ...NEVER.items.map((t) => `${NEVER.title} ${t}`),
    ...HELP.flatMap((h) => [h.q, ...rich(h.a)]),
  ];
}

/** Every `{ label }` segment the drift check must find verbatim in the app (templated labels excluded). */
export function literalLabels(): string[] {
  const rich = (r: Rich): string[] => r.flatMap((s) => (typeof s !== "string" && s.literal !== false ? [s.label] : []));
  return [
    ...rich(QUESTION.answers),
    ...BEFORE.items.flatMap(rich),
    ...STEPS.flatMap((s) => s.body.flatMap(rich)),
    ...WORDS.flatMap((w) => rich(w.text)),
    ...HELP.flatMap((h) => rich(h.a)),
  ];
}
