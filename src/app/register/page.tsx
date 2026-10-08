/**
 * Register page: server shell for account and company sign-up.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/register/page.tsx
 * Deps:    next, ./register-form, ../api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Logged-in visitors go to /onboarding; heading and the privacy line
 *
 * Design constraints:
 * - Server component
 */
import { redirect } from "next/navigation";
import { currentUser } from "../api/_lib/current-user";
import { RegisterForm } from "./register-form";

export default async function RegisterPage(): Promise<React.JSX.Element> {
  if ((await currentUser()) !== null) redirect("/onboarding");
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-zinc-400">
          We store your name, work email and company details so your team can find its briefs. Nothing else, and never
          the candidates&apos; private data.
        </p>
      </header>
      <RegisterForm />
    </main>
  );
}
