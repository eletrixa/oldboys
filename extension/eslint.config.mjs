/**
 * ESLint flat config for the extension: typescript-eslint strict + stylistic, type-checked.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/eslint.config.mjs
 * Deps:    eslint, typescript-eslint
 * Tested:  n/a (pnpm lint is part of pnpm check)
 *
 * Key responsibilities:
 * - Same rule set as the app's eslint.config.mjs minus the Next.js presets
 *
 * Design constraints:
 * - No rule is downgraded to "warn"; generated .wxt and .output are ignored
 */
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([".output/**", ".wxt/**", "node_modules/**", "e2e/**", "playwright.config.ts"]),
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/strict-boolean-expressions": ["error", { allowNullableObject: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    files: ["**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
]);
