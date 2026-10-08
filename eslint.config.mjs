/**
 * ESLint flat config: Next.js core-web-vitals + TypeScript presets.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  eslint.config.mjs
 * Deps:    eslint, eslint-config-next
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Lint src/ and config files with the Next presets
 * - Ignore generated output (.next, .open-next, .wrangler, cloudflare-env.d.ts)
 *
 * Design constraints:
 * - src/worker.ts may use @ts-ignore with a description: it imports a file that only exists after
 *   `opennextjs-cloudflare build`, so @ts-expect-error would flip between states
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "cloudflare-env.d.ts",
  ]),
  {
    files: ["src/worker.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", minimumDescriptionLength: 10 },
      ],
    },
  },
]);

export default eslintConfig;
