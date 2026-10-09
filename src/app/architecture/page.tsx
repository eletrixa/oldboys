/**
 * Architecture page: a short plain-English tour of how Radar works and links to the four archify diagrams.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/architecture/page.tsx
 * Deps:    next/link, ../ui; static diagrams in public/diagrams/ (copies of docs/diagrams/*.html)
 * Tested:  n/a (static text)
 *
 * Key responsibilities:
 * - What Radar is, its entry points, the research run, the verification call, storage, privacy and retention
 * - Four diagram cards (user journey, data flow, D1 database, high-level) that open /diagrams/<name>.html in a new tab
 *
 * Design constraints:
 * - Public, no login, no candidate data: only facts about the code
 * - The text describes the code as it is (recipe in src/recipe/goals/hiring.ts, budget and models in wrangler.jsonc,
 *   retention in src/domain/audit.ts); change it in the same commit as the behaviour
 * - Never say Radar scores or ranks people: it scores its own research
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CARD, Eyebrow, LINK, TILE } from "../ui";

export const metadata: Metadata = { title: "Architecture" };

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "entry",
    title: "Where a run starts",
    body: [
      "Recruiters use the web app with their own accounts, or the browser extension on a LinkedIn profile.",
      "Candidates can also arrive through intake: an email to jobs+<tag>@asajj.cz, the hosted /apply/<tag> page, the form API or the StartupJobs webhook. An application either starts a run at once or waits in the position's pool until the recruiter picks it.",
      "Every path ends in the same research run.",
    ],
  },
  {
    id: "run",
    title: "The research run",
    body: [
      "A Cloudflare Workflow, ResearchRunWorkflow, follows a fixed recipe for the goal. The LinkedIn profile or CV the recruiter gives is the confirmed person.",
      "First come Google searches and a name search on Instagram and Facebook. Then identity resolution sorts out namesakes: a profile counts only with a strong link to the confirmed person. When nothing is confirmed, the run asks the recruiter at most 3 \"is this the same person?\" questions.",
      "Then 21 collector steps read public sources: Apify actors for LinkedIn, social profiles, web search and personal sites; free public APIs such as GitHub, Stack Exchange, Hugging Face, ORCID, OpenAlex and Bluesky; and Czech public registries.",
      "The runner, not the AI, enforces the budget: $0.50 and 18 paid actor runs per run.",
    ],
  },
  {
    id: "ai",
    title: "Where AI is used, and how it is checked",
    body: [
      "Models run only in fixed steps. Claude Opus reads the profile or CV, extracts claims, writes the brief and, when the recruiter opens the call setup, drafts the verification call questions. Claude Sonnet verifies the claims and plays devil's advocate.",
      "A claim is a FACT only when its quote is found in the saved source text. The second model and the devil's advocate may only weaken a claim, never strengthen it.",
      "If the AI is unavailable, the brief lists only confirmed evidence and is marked NO AI.",
    ],
  },
  {
    id: "call",
    title: "Verification call",
    body: [
      "Claude Opus drafts 3 to 5 specific questions from the confirmed research, each with one follow-up and what a useful answer contains; a code filter drops sensitive topics, and if the AI fails the rule-based questions are used. The recruiter edits them, enters the number, records the candidate's consent and approves the call. An ElevenLabs voice agent makes it.",
      "VerificationCallWorkflow waits for the webhook with the result. Answers are stored as STATEMENT claims (said by the candidate), never as FACT.",
    ],
  },
  {
    id: "storage",
    title: "Storage",
    body: [
      "Cloudflare D1 holds the append-only ledger, sources, claims, candidates, gaps, briefs, calls, positions, applications and accounts (18 tables).",
      "Cloudflare R2 holds raw source payloads, CV files, call results with transcripts and the Czech translation of a brief.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy and retention",
    body: [
      "Public data only. A denylist keeps special-category data (GDPR Art. 9: health, politics, religion, ethnicity, sexuality) out of the brief, the call questions and the call notes.",
      "A nightly job deletes a run's data 7 days after the run was created. Deleting on rejection or on request does the same at once.",
    ],
  },
];

const DIAGRAMS: { href: string; title: string; text: string }[] = [
  { href: "/diagrams/user-journey.html", title: "User journey", text: "Candidate, recruiter and agent, from sign-up to export and deletion." },
  { href: "/diagrams/data-flow.html", title: "Research data flow", text: "Sources, collectors, identity, extraction, verify, synthesis and storage." },
  { href: "/diagrams/database.html", title: "D1 database", text: "All 18 tables and their foreign keys." },
  { href: "/diagrams/high-level.html", title: "High-level architecture", text: "Clients, the Cloudflare Worker and the external services." },
];

export default function ArchitecturePage(): React.JSX.Element {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <Eyebrow>Architecture</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">How Radar works</h1>
        <p className="text-muted">
          Radar researches a candidate&apos;s public footprint for one role and writes a brief where every finding links to its source. It scores its own
          research, never the person. A person makes every decision.
        </p>
      </header>

      <section aria-labelledby="diagrams" className="flex flex-col gap-4">
        <h2 id="diagrams" className="font-serif text-xl">Diagrams</h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {DIAGRAMS.map((d) => (
            <li key={d.href} className={`${CARD} flex flex-col gap-1.5`}>
              <a href={d.href} target="_blank" rel="noopener noreferrer" className={`${LINK} self-start`}>
                {d.title}
              </a>
              <span className="text-sm text-muted">{d.text}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Each diagram opens in a new tab.</p>
      </section>

      <div className="grid gap-8 md:grid-cols-2 md:gap-6">
        {SECTIONS.map((s) => (
          <section key={s.id} aria-labelledby={s.id} className={TILE}>
            <h2 id={s.id} className="font-serif text-xl">{s.title}</h2>
            {s.body.map((t) => <p key={t} className="text-sm">{t}</p>)}
          </section>
        ))}
      </div>

      <p className="text-sm text-muted">
        <Link href="/validation" className={LINK}>What is real, simulated or unfinished</Link>
        {" · "}
        <Link href="/" className={LINK}>Back to Radar</Link>
      </p>
    </main>
  );
}
