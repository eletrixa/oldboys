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
import { currentUser } from "../api/_lib/current-user";
import { LoginForm } from "./login-form";

export default async function LoginPage(): Promise<React.JSX.Element> {
  if ((await currentUser()) !== null) redirect("/");
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>
      <LoginForm />
      <p className="text-sm text-zinc-400">
        No account yet?{" "}
        <Link href="/register" className="text-teal-300 underline-offset-2 hover:underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
