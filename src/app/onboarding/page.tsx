/**
 * Onboarding page: first screen after sign-up, explains a brief and starts the first one.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/onboarding/page.tsx
 * Deps:    next, next/link, ../start-form, ../api/_lib/current-user, ../runs/[id]/state (firstName)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Gate: no session redirects to /login; welcome, a link to the /guide, start form focused on the role
 *
 * Design constraints:
 * - Server component; retention wording matches src/workflow/purge.ts (7 days)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../api/_lib/current-user";
import { firstName } from "../runs/[id]/state";
import { Eyebrow, LINK } from "../ui";
import { StartForm } from "../start-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) redirect("/login");
  const first = firstName(user.name);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <Eyebrow>Welcome</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">{first === null ? "Welcome" : `Welcome, ${first}`}</h1>
        <p className="text-muted">Start your first brief for {user.organizationName}. Pick the role, then the person.</p>
        <p className="text-sm text-muted">New to Radar? <Link href="/guide" className={LINK}>Read the 3-minute guide</Link></p>
      </header>
      <StartForm autoFocusRole />
    </main>
  );
}
