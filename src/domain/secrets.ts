/**
 * Secret presence check: a run without its Apify or Anthropic key fails at once instead of ending "done" with nothing.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/secrets.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/secrets.test.ts
 *
 * Key responsibilities:
 * - missingSecrets(env): one "<NAME> is not set" reason per missing or blank APIFY_TOKEN / ANTHROPIC_API_KEY
 *
 * Design constraints:
 * - Pure; never echoes a secret value, only its name
 */
const REQUIRED = ["APIFY_TOKEN", "ANTHROPIC_API_KEY"] as const;

export function missingSecrets(env: { APIFY_TOKEN?: string; ANTHROPIC_API_KEY?: string }): string[] {
  return REQUIRED.filter((name) => (env[name] ?? "").trim() === "").map((name) => `${name} is not set`);
}
