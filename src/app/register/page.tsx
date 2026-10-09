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
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eyebrow } from "../ui";
import { currentUser } from "../api/_lib/current-user";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage(): Promise<React.JSX.Element> {
  if ((await currentUser()) !== null) redirect("/onboarding");
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Account</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Create your account</h1>
        <p className="text-sm text-muted">
          We store your name, work email and company details so your team can find its briefs. Nothing else, and never
          the candidates&apos; private data.
        </p>
      </header>
      <RegisterForm />
    </main>
  );
}
