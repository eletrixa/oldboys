/**
 * Onboarding page: first screen after sign-up, explains a brief and starts the first one.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/onboarding/page.tsx
 * Deps:    next, ../start-form, ../api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Gate: no session redirects to /login; welcome, start form focused on the role
 *
 * Design constraints:
 * - Server component; retention wording matches src/workflow/purge.ts (7 days)
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "../api/_lib/current-user";
import { Eyebrow } from "../ui";
import { StartForm } from "../start-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) redirect("/login");
  const firstName = user.name.trim().split(/\s+/)[0] ?? "";
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <Eyebrow>Welcome</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">{firstName === "" ? "Welcome" : `Welcome, ${firstName}`}</h1>
        <p className="text-muted">Start your first brief for {user.organizationName}. Pick the role, then the person.</p>
      </header>
      <StartForm autoFocusRole />
    </main>
  );
}
