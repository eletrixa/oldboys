/**
 * New position page: paste a posting or give its URL.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/new/page.tsx
 * Deps:    ./new-position-form
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Server shell for the client NewPositionForm
 *
 * Design constraints:
 * - Server component; no data fetching here
 */
import { NewPositionForm } from "./new-position-form";

export default function NewPositionPage(): React.JSX.Element {
  return <NewPositionForm />;
}
