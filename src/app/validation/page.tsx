/**
 * Validation page: the eval headline and its misses, and what in Radar is real, simulated or not finished.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/validation/page.tsx
 * Deps:    next/link, eval/results.json (written by `pnpm eval`), ../ui
 * Tested:  n/a (static; the numbers come from eval/results.json, which eval/__tests__/eval.test.ts guards)
 *
 * Key responsibilities:
 * - Eval headline ("caught X of Y checks"), per persona and per category tables, every miss with its reason
 * - Plain-language lists: what is real, what is simulated (and how the app labels it), what is incomplete
 *
 * Design constraints:
 * - Public, no login, no candidate data: only synthetic personas and facts about the code
 * - The lists describe the code as it is; change them in the same commit as the behaviour (README has the same lists)
 */
import type { Metadata } from "next";
import Link from "next/link";
import results from "../../../eval/results.json";
import type { EvalReport } from "../../../eval/score";
import { CARD, CARD_FLUSH, CARD_SAGE, Eyebrow, LINK, Pill, SimulatedPill } from "../ui";

export const metadata: Metadata = { title: "Validation · Radar" };

const report = results as EvalReport;

const REAL = [
  "Research runs live: Google search and public profiles (LinkedIn, X, Instagram, TikTok, YouTube, personal sites) through Apify, plus the public GitHub, Stack Exchange, Hugging Face, ORCID, OpenAlex and Bluesky APIs.",
  "Every finding links to its source. A finding is shown as a fact only when its quote is found in the saved page text; then a second AI model checks it, and a devil's advocate re-checks the role must-haves. Both may only weaken a finding.",
  "The LinkedIn profile or CV the recruiter gives is the confirmed person. Other profiles with the same name are shown as \"same name, not confirmed\" until the recruiter confirms them.",
  "Candidates arrive by email, the apply page, a form API or the StartupJobs webhook; a position can be created from a job ad link.",
  "Candidate data is deleted after 7 days, or at once on rejection or request; each run has an audit record and a data export.",
  "Phone verification with the candidate runs through ElevenLabs and Twilio when it is switched on. Answers are kept as \"said by the candidate\", never as public facts.",
];

const SIMULATED: { kind: "mock" | "cached" | "no-ai" | null; text: string }[] = [
  { kind: "mock", text: "Phone call with CALL_PROVIDER=mock: no one is called, the answers are canned and cost nothing." },
  { kind: "cached", text: "A finished brief opened more than 30 minutes after it ran is the stored copy; no source is fetched again." },
  { kind: "no-ai", text: "When the AI is unavailable, the brief lists only confirmed sources and template interview questions." },
  { kind: null, text: "The eval set on this page: five fictional people; their search results, pages and every AI answer are recorded, not live." },
  { kind: null, text: "The sample brief and finding card on the landing page show a fictional candidate, marked \"fictional example\"." },
  { kind: null, text: "Company register (ARES) lookups at sign-up are served from a stored copy when the same company number was asked before." },
];

const INCOMPLETE = [
  "No eval on real, consenting people with written ground truth yet. The only checks on real runs are hand-written reviews of team members' briefs (eval/reviews).",
  "The eval measures our rules and wiring, not the live AI's judgement: its AI answers are recorded.",
  "Nothing is written back to an ATS. \"Copy for ATS\" copies text to paste by hand; the interview invite is a downloaded calendar file.",
  "Facebook profiles are not opened (they need a login); only search snippets are read.",
  "The known misses listed above are not fixed yet.",
];

const pct = (p: number, t: number): string => (t === 0 ? "0" : String(Math.round((p / t) * 100)));

export default function ValidationPage(): React.JSX.Element {
  const h = report.headline;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <Eyebrow>Validation</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">What works, what is simulated, what is missing</h1>
        <p className="text-muted">We test the research, never the candidate. This page is generated from the code and the eval results in the repository.</p>
      </header>

      <section aria-labelledby="eval" className={`${CARD} flex flex-col gap-4`}>
        <h2 id="eval" className="font-serif text-xl">Eval set</h2>
        <p className="font-serif text-3xl">
          Caught {h.passed} of {h.total} checks <span className="text-base text-muted">({pct(h.passed, h.total)} %)</span>
        </p>
        <p className="text-sm text-muted">
          Five fictional candidates with traps written in advance: namesakes, a forked repository, a quote that is not in its source, hedged wording, a CV that
          differs from LinkedIn, course homework, old evidence, an AI outage. Each runs through the real research steps. Misses: {h.unsafe_misses} unsafe (the brief
          shows something false), {h.conservative_misses} conservative (the brief holds back something true).
        </p>
        <p className="text-sm text-muted">
          Run it with <code>pnpm eval</code>; the full table is in <code>eval/RESULTS.md</code>. The test suite fails if a check that passes today starts to miss.
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr><th className="py-1 font-medium">Persona</th><th className="py-1 text-right font-medium">Passed</th></tr>
          </thead>
          <tbody>
            {report.personas.map((p) => (
              <tr key={p.id} className="border-t border-divider">
                <td className="py-2 pr-4">{p.title}</td>
                <td className="py-2 text-right whitespace-nowrap tabular-nums">{p.passed} / {p.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="flex flex-wrap gap-2">
          {report.by_category.map((c) => (
            <li key={c.category}><Pill tone={c.passed === c.total ? "ok" : "unsure"}>{c.label}: {c.passed} / {c.total}</Pill></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="misses" className={`${CARD_FLUSH} flex flex-col`}>
        <h2 id="misses" className="px-5 pt-5 font-serif text-xl md:px-6">Known misses ({report.misses.length})</h2>
        <ul className="flex flex-col">
          {report.misses.map((m) => (
            <li key={`${m.persona}:${m.label}`} className="flex flex-col gap-1 border-t border-divider px-5 py-3 text-sm first:mt-3 md:px-6">
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone={m.severity === "unsafe" ? "conflict" : "unsure"}>{m.severity}</Pill>
                <span className="text-xs text-muted">{m.persona}</span>
              </span>
              <span>{m.label}</span>
              <span className="text-muted">{m.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="real" className={CARD}>
        <h2 id="real" className="mb-3 font-serif text-xl">What is real</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">{REAL.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      <section aria-labelledby="simulated" className={CARD}>
        <h2 id="simulated" className="mb-1 font-serif text-xl">What is simulated</h2>
        <p className="mb-3 text-sm text-muted">The app marks each of these where it appears.</p>
        <ul className="flex flex-col gap-3 text-sm">
          {SIMULATED.map((s) => (
            <li key={s.text} className="flex flex-wrap items-start gap-2">
              {s.kind === null ? <Pill tone="neutral">NOT LIVE</Pill> : <SimulatedPill kind={s.kind} />}
              <span className="min-w-0 flex-1">{s.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="incomplete" className={CARD_SAGE}>
        <h2 id="incomplete" className="mb-3 font-serif text-xl">What is incomplete</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">{INCOMPLETE.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>

      <p className="text-sm text-muted">
        <Link href="/" className={LINK}>Back to Radar</Link>
      </p>
    </main>
  );
}
