/**
 * Next.js configuration for the OpenNext-on-Workers build.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  next.config.ts
 * Deps:    next, @opennextjs/cloudflare
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Disable the image optimizer (unavailable on Workers)
 * - Expose wrangler bindings to `next dev` via initOpenNextCloudflareForDev
 *
 * Design constraints:
 * - Never set output: "standalone"; OpenNext owns the output format
 * - No runtime = "edge" anywhere in the app
 */
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
