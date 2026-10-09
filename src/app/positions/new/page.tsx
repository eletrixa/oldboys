/**
 * New position page: paste a posting or give its URL.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/new/page.tsx
 * Deps:    ./new-position-form, src/app/login/next-path (safeNext)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Server shell for the client NewPositionForm; a safe `?next=` path (the New brief wizard) gets the new id as `positionId`
 *
 * Design constraints:
 * - Server component; no data fetching here
 */
import { safeNext } from "@/app/login/next-path";
import { NewPositionForm } from "./new-position-form";

export default async function NewPositionPage({ searchParams }: { searchParams: Promise<{ next?: string }> }): Promise<React.JSX.Element> {
  const next = safeNext((await searchParams).next);
  return <NewPositionForm next={next === "/" ? null : next} />;
}
