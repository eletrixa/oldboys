/**
 * Roles page: list of roles with their brief counts (idea #16).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/roles/page.tsx
 * Deps:    ./roles-view
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Server shell for the client RolesView without a selected role
 *
 * Design constraints:
 * - Server component; fetching and the log-in prompt live in roles-view.tsx
 */
import { RolesView } from "./roles-view";

export default function RolesPage(): React.JSX.Element {
  return <RolesView />;
}
