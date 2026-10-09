/**
 * Runs the eval set: every persona through the real seams, scored against its ground truth.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/run.ts
 * Deps:    eval/harness, eval/score, eval/personas
 * Tested:  eval/__tests__/eval.test.ts (runEval); `main` via `pnpm eval` (scripts/eval.mjs)
 *
 * Key responsibilities:
 * - `runEval()`: the report, each persona run twice: with the simulated recruiter answering the lineup (headline) and
 *   strict (no answer); lineup questions counted; throws when a persona hit a harness problem in either mode
 * - `main()`: prints the table and writes eval/results.json and eval/RESULTS.md
 *
 * Design constraints:
 * - No network, no keys, no timestamps in the output (the committed files change only when results change)
 */
import { runPersona } from "./harness";
import { PERSONAS } from "./personas";
import { type EvalReport, lineupReport, markdown, type ModeReport, scorePersona, summarize } from "./score";

export async function runEval(): Promise<EvalReport> {
  const recruiter = [];
  const strict = [];
  const lineups = [];
  for (const p of PERSONAS) {
    const r = await runPersona(p, "recruiter");
    const s = await runPersona(p, "strict");
    for (const x of [r, s]) if (x.problems.length > 0) throw new Error(`${p.id}: ${x.problems.join("; ")}`);
    recruiter.push(scorePersona(p, r));
    strict.push(scorePersona(p, s));
    lineups.push({ id: p.id, lineup: r.lineup });
  }
  return { mode: "simulated-recruiter", ...summarize(recruiter), lineup: lineupReport(lineups), strict: summarize(strict) };
}

const scoreLine = (h: ModeReport["headline"]): string =>
  `${String(h.passed)} of ${String(h.total)} checks (${String(h.unsafe_misses)} unsafe, ${String(h.conservative_misses)} conservative misses)`;

export async function main(root: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  const report = await runEval();
  const l = report.lineup;
  const strictOf = new Map(report.strict.personas.map((p) => [p.id, p]));
  const lines = [
    `Simulated recruiter: caught ${scoreLine(report.headline)}`,
    `Strict (no lineup answer): caught ${scoreLine(report.strict.headline)}`,
    `Lineup questions asked: ${String(l.asked)} (${String(l.own)} own, ${String(l.namesake)} namesake, ${String(l.unknown)} not in the truth), ${String(l.left_open)} left open`,
    "",
    "  persona                recruiter  strict",
    ...report.personas.map((p) => `  ${p.id.padEnd(22)} ${String(p.passed).padStart(3)} / ${String(p.total).padEnd(4)} ${String(strictOf.get(p.id)?.passed ?? 0).padStart(3)} / ${String(p.total)}`),
    "",
    ...report.misses.map((m) => `MISS [${m.severity}] ${m.persona}: ${m.label} -> ${m.detail}`),
    ...report.strict.misses.map((m) => `STRICT MISS [${m.severity}] ${m.persona}: ${m.label} -> ${m.detail}`),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  await writeFile(`${root}eval/results.json`, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(`${root}eval/RESULTS.md`, markdown(report));
}
