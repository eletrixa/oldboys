/**
 * OpenNext adapter configuration for Cloudflare Workers.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  open-next.config.ts
 * Deps:    @opennextjs/cloudflare
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Declare the Cloudflare build overrides (none yet: no incremental cache)
 *
 * Design constraints:
 * - Add a KV/R2 incremental cache only when ISR is actually used
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
