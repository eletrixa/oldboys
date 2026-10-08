/**
 * Home page: Radar intro, how the brief is made, and the start form.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/page.tsx
 * Deps:    next, next/link, ./start-form, ./login/next-path, ./api/_lib/current-user, ./ui
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Editorial heading, sub copy and the client start form (Screen 1) in a white card
 * - Three plain steps (what Radar does) and the "never a score" line
 * - Logged-out visitors go to /login with `?positionId=` carried in `next`
 * - Small link to /positions (pick or add a position; /roles stays reachable by URL)
 *
 * Design constraints:
 * - Server component; interactivity lives in start-form.tsx
 * - Radar Visual Guideline: one primary action per view, plain language, no surveillance imagery
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "./api/_lib/current-user";
import { loginHref } from "./login/next-path";
import { ROLE_TITLES } from "@/domain/role-catalog";
import { StartForm } from "./start-form";
import { CARD, Eyebrow, LINK } from "./ui";

const STEPS: readonly (readonly [string, string])[] = [
  ["Gather evidence", "We read their public professional work and keep the exact words and the page each claim came from."],
  ["Review claims", "Every point says if a source supports it, and the brief lists what we could not find or did not search."],
  ["Prepare the conversation", "Gaps become suggested interview questions. You make the decision."],
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ positionId?: string }> }): Promise<React.JSX.Element> {
  const user = await currentUser();
  if (user === null) {
    const { positionId } = await searchParams;
    redirect(loginHref(typeof positionId === "string" && positionId !== "" ? `/?positionId=${encodeURIComponent(positionId)}` : "/"));
  }
  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:items-start md:py-16">
      <section className="flex flex-col gap-6">
        <Eyebrow>Evidence-led hiring</Eyebrow>
        <h1 className="text-5xl leading-[1.05] md:text-6xl">
          Who are you
          <span className="block pl-8 md:pl-12">hiring?</span>
        </h1>
        <p className="max-w-[44ch] text-lg leading-relaxed text-muted">
          Give us their LinkedIn profile or CV. Radar checks their public work and gives you a short brief with a source
          for every point.
        </p>
        <ol className="flex flex-col border-t border-divider">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-divider py-4">
              <span className="font-serif text-xl text-action tabular-nums">{i + 1}</span>
              <span className="flex flex-col gap-1">
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">No overall score. Coverage describes the research, not the person.</p>
      </section>
      <section className="flex flex-col gap-4">
        <div className={`${CARD} md:p-8`}>
          <h2 className="mb-1 text-2xl">Start a brief</h2>
          <p className="mb-5 text-sm text-muted">Hiring at {user.organizationName}</p>
          <StartForm roleOptions={ROLE_TITLES} />
        </div>
        <p className="px-1 text-sm text-muted">
          Hiring for a position?{" "}
          <Link href="/positions" className={LINK}>
            See positions
          </Link>
        </p>
      </section>
    </main>
  );
}
