/**
 * Hosted apply page: the URL behind LinkedIn "apply on external website" and the job ad text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/page.tsx
 * Deps:    next, @opennextjs/cloudflare (getCloudflareContext), binding DB, ./apply-form, src/domain/application
 * Tested:  n/a (lookup and submit are covered by src/app/api/apply/__tests__/apply.test.ts)
 *
 * Key responsibilities:
 * - Await params, validate the tag, read the role from intake_tags; unknown or invalid tag is a 404
 * - Candidate-facing heading and one line of copy around the client form
 *
 * Design constraints:
 * - Server component, rendered per request (positions change without a deploy)
 * - Candidate-facing: calm, short, no mention of research, scoring or runs
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { notFound } from "next/navigation";
import { IntakeTag } from "@/domain/application";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

export default async function ApplyPage({ params }: { params: Promise<{ tag: string }> }): Promise<React.JSX.Element> {
  const { tag: rawTag } = await params;
  const tag = IntakeTag.safeParse(rawTag);
  if (!tag.success) notFound();

  const { env } = getCloudflareContext();
  const position = await env.DB.prepare("SELECT role FROM intake_tags WHERE tag = ?").bind(tag.data).first<{ role: string }>();
  if (position === null) notFound();

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12 md:py-16">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.08em] text-action uppercase">Apply</p>
        <h1 className="text-4xl leading-[1.1] md:text-5xl">{position.role}</h1>
        <p className="text-lg leading-relaxed text-muted">Leave your LinkedIn profile or CV. We read it and reply by email.</p>
      </header>
      <div className="rounded-2xl border border-divider bg-surface p-6 shadow-[0_12px_40px_rgba(40,45,43,0.08)] md:p-8">
        <ApplyForm tag={tag.data} />
      </div>
    </main>
  );
}
