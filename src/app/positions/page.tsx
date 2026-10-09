/**
 * Positions page: the recruiter's title selector (own postings plus the preselected role catalog).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/page.tsx
 * Deps:    ./positions-view, src/domain/role-catalog (ROLE_OPTIONS)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Server shell for the client PositionsView; hands it the catalog titles (title, family, aliases only)
 *
 * Design constraints:
 * - Server component; token handling and fetching live in positions-view.tsx
 */
import { ROLE_OPTIONS } from "@/domain/role-catalog";
import { PositionsView } from "./positions-view";

export default function PositionsPage(): React.JSX.Element {
  return <PositionsView catalog={ROLE_OPTIONS} />;
}
