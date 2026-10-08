/**
 * Login page: server shell that sends logged-in visitors home.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/login/page.tsx
 * Deps:    next, next/link, ./login-form, ../api/_lib/current-user
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Heading, the login form and a link to /register
 *
 * Design constraints:
 * - Server component
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eyebrow, LINK } from "../ui";
import { currentUser } from "../api/_lib/current-user";
import { LoginForm } from "./login-form";

export default async function LoginPage(): Promise<React.JSX.Element> {
  if ((await currentUser()) !== null) redirect("/");
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col gap-3">
        <Eyebrow>Account</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Log in</h1>
        <p className="max-w-[62ch] text-muted">Radar prepares a sourced brief on a candidate for your hiring team. Log in to start one.</p>
      </header>
      <LoginForm />
      <p className="text-sm text-muted">
        No account yet?{" "}
        <Link href="/register" className={LINK}>
          Create one
        </Link>
      </p>
    </main>
  );
}
