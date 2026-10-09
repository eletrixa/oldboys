/**
 * Runs the eval set: every persona through the real seams, scored against its ground truth.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eval/run.ts
 * Deps:    eval/harness, eval/score, eval/personas
 * Tested:  eval/__tests__/eval.test.ts (runEval); `main` via `pnpm eval` (scripts/eval.mjs)
 *
 * Key responsibilities:
 * - `runEval()`: the report (headline, per persona, per category, misses); throws when a persona hit a harness problem
 * - `main()`: prints the table and writes eval/results.json and eval/RESULTS.md
 *
 * Design constraints:
 * - No network, no keys, no timestamps in the output (the committed files change only when results change)
 */
import { runPersona } from "./harness";
import { PERSONAS } from "./personas";
import { type EvalReport, markdown, scorePersona, summarize } from "./score";

export async function runEval(): Promise<EvalReport> {
  const scores = [];
  for (const p of PERSONAS) {
    const r = await runPersona(p);
    if (r.problems.length > 0) throw new Error(`${p.id}: ${r.problems.join("; ")}`);
    scores.push(scorePersona(p, r));
  }
  return summarize(scores);
}

export async function main(root: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  const report = await runEval();
  const h = report.headline;
  const lines = [
    `Caught ${String(h.passed)} of ${String(h.total)} checks (${String(h.unsafe_misses)} unsafe, ${String(h.conservative_misses)} conservative misses)`,
    "",
    ...report.personas.map((p) => `  ${p.id.padEnd(22)} ${String(p.passed).padStart(3)} / ${String(p.total)}`),
    "",
    ...report.misses.map((m) => `MISS [${m.severity}] ${m.persona}: ${m.label} -> ${m.detail}`),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
  await writeFile(`${root}eval/results.json`, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(`${root}eval/RESULTS.md`, markdown(report));
}
