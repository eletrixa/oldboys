/**
 * Apify text helpers shared by the web collectors.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/text.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/sources-web.test.ts
 *
 * Key responsibilities:
 * - txt(): flatten the loosely-typed scalar/object/array values scraped actors return into a string
 *
 * Design constraints:
 * - Pure: no network; the runner performs the actor call. Parsing is lenient (unknown fields ignored)
 * - Input fields verified against n/a (helper)
 */

/** Flatten a loosely-typed actor value (string, number, {text|name|...}, array) into display text. */
export function txt(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    for (const k of ["linkedinText", "text", "full", "name", "year"]) {
      const t = txt(o[k]);
      if (t) return t;
    }
    const range = [txt(o.start), txt(o.end)].filter(Boolean);
    if (range.length > 0) return range.join("–");
    return [txt(o.city), txt(o.state), txt(o.country)].filter(Boolean).join(", ");
  }
  return "";
}

export function lines(items: readonly string[]): string {
  return items.filter(Boolean).join("\n");
}
