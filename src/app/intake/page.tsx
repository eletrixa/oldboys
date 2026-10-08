/**
 * Intake page: the application queue and the position tags.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/intake/page.tsx
 * Deps:    ./intake-view
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Server shell for the client IntakeView
 *
 * Design constraints:
 * - Server component; token handling and fetching live in intake-view.tsx
 */
import { IntakeView } from "./intake-view";

export default function IntakePage(): React.JSX.Element {
  return <IntakeView />;
}
