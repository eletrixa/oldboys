/**
 * Runner for scripts/role-catalog-sql.ts: bundles it with the esbuild API (the pnpm bin shim cannot exec the native
 * binary here) and runs the bundle.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  scripts/role-catalog-sql.mjs
 * Deps:    esbuild (JS API)
 * Tested:  n/a (pnpm roles:sql)
 */
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outfile = `${root}node_modules/.cache/role-catalog-sql.mjs`;
mkdirSync(`${root}node_modules/.cache`, { recursive: true });
await build({ entryPoints: [`${root}scripts/role-catalog-sql.ts`], bundle: true, platform: "node", format: "esm", packages: "external", outfile, logLevel: "warning" });
await import(outfile);
