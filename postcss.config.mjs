/**
 * PostCSS pipeline: Tailwind v4 only.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  postcss.config.mjs
 * Deps:    @tailwindcss/postcss
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Register the Tailwind PostCSS plugin
 *
 * Design constraints:
 * - No other PostCSS plugins without a reason
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
