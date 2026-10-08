/**
 * Positions page: the recruiter's selector of open positions.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/page.tsx
 * Deps:    ./positions-view
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Server shell for the client PositionsView
 *
 * Design constraints:
 * - Server component; token handling and fetching live in positions-view.tsx
 */
import { PositionsView } from "./positions-view";

export default function PositionsPage(): React.JSX.Element {
  return <PositionsView />;
}
