/**
 * Onboarding page: first screen after sign-up, explains a brief and starts the first one.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/onboarding/page.tsx
 * Deps:    next, ../start-form, ../api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Gate: no session redirects to /login; welcome, what a brief is, start form focused on the role
 *
 * Design constraints:
 * - Server component; retention wording matches src/workflow/purge.ts (7 days)
 */
import { redirect } from "next/navigation";
import { currentUser } from "../api/_lib/current-user";
import { StartForm } from "../start-form";

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) redirect("/login");
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Your company is {user.organizationName}</h1>
        <p className="text-zinc-400">What role are you hiring for first?</p>
      </header>
      <section aria-label="What a brief is" className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
        <h2 className="mb-1 font-medium text-zinc-100">What a brief is</h2>
        <p>
          A brief uses public sources only. Every point links to its source, so you can check it yourself. It takes a
          few minutes and everything collected is deleted after 7 days.
        </p>
      </section>
      <StartForm autoFocusRole />
    </main>
  );
}
