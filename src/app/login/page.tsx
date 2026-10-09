/**
 * Login page: server shell that sends logged-in visitors home.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/login/page.tsx
 * Deps:    next, ./login-form, ./next-path, ../api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Heading and the login form (which carries the link to /register)
 * - Reads `?next=` (same-site only, via safeNext) for the redirect after login
 *
 * Design constraints:
 * - Server component
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Eyebrow } from "../ui";
import { currentUser } from "../api/_lib/current-user";
import { LoginForm } from "./login-form";
import { safeNext } from "./next-path";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }): Promise<React.JSX.Element> {
  const next = safeNext((await searchParams).next);
  if ((await currentUser()) !== null) redirect(next);
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Account</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Log in</h1>
        <p className="max-w-[62ch] text-muted">Log in to start a sourced brief on a candidate and to open the briefs your team already has.</p>
      </header>
      <LoginForm next={next} />
    </main>
  );
}
