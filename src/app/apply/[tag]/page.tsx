/**
 * Hosted apply page: the URL behind LinkedIn "apply on external website" and the job ad text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/page.tsx
 * Deps:    next, react (cache), ./position (loadPosition), ./apply-form, ./apply-copy, src/app/ui
 * Tested:  n/a (lookup and submit are covered by src/app/api/apply/__tests__/apply.test.ts; copy in apply-fields.test.ts)
 *
 * Key responsibilities:
 * - Await params, validate the tag, read the role and company from intake_tags; unknown or invalid tag is a 404
 * - `generateMetadata`: tab title and link preview "Apply: <role> at <company>" plus one plain line, never the product's
 * - Heading (role), the company under it, one line of copy, a language switch (`?lang=cs` for the Jobs.cz ad) and the
 *   client form with the privacy line and its notice link
 *
 * Design constraints:
 * - Server component, rendered per request (positions change without a deploy)
 * - Candidate-facing: calm, short, no mention of research, scoring or runs
 * - The `lang` attribute sits on <main> (the root layout owns <html>), so screen readers switch voice for Czech
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CARD, Eyebrow, LINK } from "@/app/ui";
import { ApplyForm } from "./apply-form";
import { COPY, toLang } from "./apply-copy";
import { loadPosition, privacyHref } from "./position";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tag: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ tag }, query] = await Promise.all([params, searchParams]);
  const position = await loadPosition(tag);
  if (position === null) return {};
  const copy = COPY[toLang(query.lang)].page;
  const title = copy.title(position.role, position.company);
  return {
    title,
    description: copy.description,
    openGraph: { title, description: copy.description, type: "website" },
    alternates: { languages: { en: `/apply/${position.tag}`, cs: `/apply/${position.tag}?lang=cs` } },
  };
}

export default async function ApplyPage({ params, searchParams }: Props): Promise<React.JSX.Element> {
  const [{ tag }, query] = await Promise.all([params, searchParams]);
  const position = await loadPosition(tag);
  if (position === null) notFound();
  const lang = toLang(query.lang);
  const copy = COPY[lang];
  const other = copy.page.other;

  return (
    <main lang={lang} className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12 md:py-16">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Eyebrow>{copy.page.eyebrow}</Eyebrow>
          <a href={other.lang === "en" ? `/apply/${position.tag}` : `/apply/${position.tag}?lang=${other.lang}`} hrefLang={other.lang} lang={other.lang} className={`${LINK} inline-flex min-h-11 items-center text-sm`}>
            {other.label}
          </a>
        </div>
        <h1 className="text-4xl leading-[1.1] md:text-5xl">{position.role}</h1>
        {position.company !== null && <p className="text-xl text-ink">{copy.page.atCompany(position.company)}</p>}
        <p className="text-lg leading-relaxed text-muted">{copy.page.intro}</p>
      </header>
      <div className={CARD}>
        <ApplyForm tag={position.tag} lang={lang} privacy={{ line: copy.privacy.line(position.company), href: privacyHref(position.tag, lang) }} />
      </div>
    </main>
  );
}
