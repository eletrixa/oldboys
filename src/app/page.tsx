/**
 * Home page: the public landing for logged-out visitors; a logged-in recruiter goes straight to their briefs (plans/012).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/page.tsx
 * Deps:    next/navigation, ./api/_lib/current-user, ./login/next-path, ./landing/landing
 * Tested:  by e2e/brief-flow.spec.ts (S1)
 *
 * Key responsibilities:
 * - Logged out: the landing (src/app/landing); with `?positionId=` go to /login with /briefs/new?positionId= carried in `next`
 * - Logged in: redirect to /briefs, or to /briefs/new?positionId= when a position is carried
 *
 * Design constraints:
 * - Server component; no data fetching beyond the session
 */
import { redirect } from "next/navigation";
import { currentUser } from "./api/_lib/current-user";
import { Landing } from "./landing/landing";
import { loginHref } from "./login/next-path";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ positionId?: string }> }): Promise<React.JSX.Element> {
  const user = await currentUser();
  const { positionId } = await searchParams;
  const carried = typeof positionId === "string" && positionId !== "" ? `/briefs/new?positionId=${encodeURIComponent(positionId)}` : null;
  if (user === null) {
    if (carried === null) return <Landing />;
    redirect(loginHref(carried));
  }
  redirect(carried ?? "/briefs");
}
