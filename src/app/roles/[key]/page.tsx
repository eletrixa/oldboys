/**
 * Role page: evidence table for the briefs made for one role (idea #16).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/roles/[key]/page.tsx
 * Deps:    ../roles-view
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Await the params Promise, decode the role key and hand it to the client RolesView
 *
 * Design constraints:
 * - Server component; the key is the normalized role text from roleKey (src/domain/role-overview.ts)
 */
import { RolesView } from "../roles-view";

export default async function RolePage({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<React.JSX.Element> {
  const { key } = await params;
  let roleKey = key;
  try {
    roleKey = decodeURIComponent(key);
  } catch {
    // Malformed escape: keep the raw segment, the view then shows "No briefs for this role".
  }
  return <RolesView roleKey={roleKey} />;
}
