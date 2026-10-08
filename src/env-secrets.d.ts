/**
 * Secrets that `pnpm cf-typegen` only emits when present in the local .dev.vars; declared here so
 * the code typechecks on every clone. Merges into the generated CloudflareEnv interface.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/env-secrets.d.ts
 * Deps:    cloudflare-env.d.ts (generated)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Keep optional secrets typed as `string | undefined` so routes must handle the unset case
 *
 * Design constraints:
 * - Interfaces are required here for declaration merging (lint rule disabled for that reason)
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface CloudflareEnv {
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_WEBHOOK_SECRET?: string;
  INTAKE_TOKEN?: string;
  STARTUPJOBS_WEBHOOK_TOKEN?: string;
  STARTUPJOBS_TOKEN?: string;
}
