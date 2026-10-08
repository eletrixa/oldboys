/**
 * Run page: server shell for the brief progress and result view.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/page.tsx
 * Deps:    next, next/link, ./run-view
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Await the params Promise and hand the run id to the client view
 * - One small "Audit record" link under the view (GDPR record at /runs/:id/audit)
 *
 * Design constraints:
 * - Server component; polling and answers live in run-view.tsx
 */
import Link from "next/link";
import { RunView } from "./run-view";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <>
      <RunView id={id} />
      <div className="mx-auto max-w-3xl px-4 pb-10">
        <Link href={`/runs/${id}/audit`} className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
          Audit record
        </Link>
      </div>
    </>
  );
}
