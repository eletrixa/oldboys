/**
 * Runner for `pnpm eval`: bundles eval/run.ts with the esbuild API (resolves the @/ alias from tsconfig) and runs it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  scripts/eval.mjs
 * Deps:    esbuild (JS API)
 * Tested:  n/a (the same eval runs in eval/__tests__/eval.test.ts)
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outfile = `${root}node_modules/.cache/eval-run.mjs`;
mkdirSync(`${root}node_modules/.cache`, { recursive: true });
await build({ entryPoints: [`${root}eval/run.ts`], bundle: true, platform: "node", format: "esm", packages: "external", outfile, logLevel: "warning" });
const { main } = await import(outfile);
await main(root);
