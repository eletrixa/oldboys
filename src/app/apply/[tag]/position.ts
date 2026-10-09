/**
 * The open position behind an apply link: its tag, role and employer, read once per request from intake_tags.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/position.ts
 * Deps:    react (cache), @opennextjs/cloudflare (getCloudflareContext), binding DB, src/domain/application (IntakeTag), ./apply-copy (Lang)
 * Tested:  n/a (one SELECT; the page and the privacy notice are driven in the browser QA of specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - `loadPosition(rawTag)`: null for an invalid or unknown tag (the caller answers 404), else `{tag, role, company}`;
 *   React `cache` shares one D1 read between generateMetadata and the page
 * - `privacyHref(tag, lang)`: the privacy notice of that position in that language
 *
 * Design constraints:
 * - Server only (D1 binding); never exposes anything but the role and the company
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";
import { IntakeTag } from "@/domain/application";
import type { Lang } from "./apply-copy";

export type ApplyPosition = { tag: string; role: string; company: string | null };

export const loadPosition = cache(async (rawTag: string): Promise<ApplyPosition | null> => {
  const tag = IntakeTag.safeParse(rawTag);
  if (!tag.success) return null;
  const { env } = getCloudflareContext();
  const row = await env.DB.prepare("SELECT role, company FROM intake_tags WHERE tag = ?").bind(tag.data).first<{ role: string; company: string | null }>();
  return row === null ? null : { tag: tag.data, role: row.role, company: row.company };
});

export function privacyHref(tag: string, lang: Lang): string {
  return `/apply/${tag}/privacy${lang === "en" ? "" : `?lang=${lang}`}`;
}
