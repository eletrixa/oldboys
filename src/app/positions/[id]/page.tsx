/**
 * Position page: one position with its must-haves and the candidates researched for it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/[id]/page.tsx
 * Deps:    ../position-detail
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Await the params Promise and hand the id to the client PositionDetailView
 *
 * Design constraints:
 * - Server component; the id is used as given, the API answers 404 for unknown ids
 */
import { PositionDetailView } from "../position-detail";

export default async function PositionPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  return <PositionDetailView id={id} />;
}
