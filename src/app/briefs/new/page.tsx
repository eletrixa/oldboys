/**
 * New brief page (plans/012): server shell that gates on the session and hands the positions and the role catalog to the wizard.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/new/page.tsx
 * Deps:    next/navigation, @opennextjs/cloudflare, src/app/api/_lib/current-user, src/app/api/positions/handler (listPositions), src/app/login/next-path, src/domain/role-catalog, ./new-brief-wizard
 * Tested:  by e2e/brief-flow.spec.ts
 *
 * Key responsibilities:
 * - No session: redirect to /login with this page (and `?positionId=`) carried in `next`
 * - `?positionId=` preselects a position (the return from /positions/new?next=/briefs/new)
 *
 * Design constraints:
 * - Server component; positions are team-shared, the same list as /positions
 */
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";
import { currentUser } from "@/app/api/_lib/current-user";
import { listPositions } from "@/app/api/positions/handler";
import { loginHref } from "@/app/login/next-path";
import { ROLE_OPTIONS } from "@/domain/role-catalog";
import { NewBriefWizard } from "./new-brief-wizard";

export const metadata: Metadata = { title: "New brief" };

export default async function NewBriefPage({ searchParams }: { searchParams: Promise<{ positionId?: string; role?: string }> }): Promise<React.JSX.Element> {
  const { positionId, role } = await searchParams;
  const initial = typeof positionId === "string" && positionId !== "" ? positionId : null;
  const initialRole = typeof role === "string" ? role.trim().slice(0, 300) : "";
  const user = await currentUser();
  if (user === null) {
    const next = initial !== null ? `/briefs/new?positionId=${encodeURIComponent(initial)}` : initialRole !== "" ? `/briefs/new?role=${encodeURIComponent(initialRole)}` : "/briefs/new";
    redirect(loginHref(next));
  }
  const positions = await listPositions(getCloudflareContext().env.DB);
  return <NewBriefWizard positions={positions} roleOptions={ROLE_OPTIONS} initialPositionId={initial} initialRole={initialRole} />;
}
