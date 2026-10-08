/**
 * Candidates overview per role (idea #16): list of roles, or one role's evidence table.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/roles/roles-view.tsx
 * Deps:    next/link, react, src/domain/role-overview, src/app/ui, src/app/_components/role-table
 * Tested:  builder in src/domain/__tests__/role-overview.test.ts; view n/a
 *
 * Key responsibilities:
 * - GET /api/roles with the session cookie (scoped to the organization); 401 shows a log-in prompt
 * - No roleKey: roles with run counts; roleKey: rows = runs newest first, columns = must-haves + sources confirmed
 *
 * Design constraints:
 * - Client component; no token handling, the session cookie travels by default
 * - Radar design (docs/design/radar-ui.md): semantic tokens and src/app/ui.tsx classes only
 * - Table scrolls sideways inside a focusable labelled region; the person column stays sticky
 * - Shows the amount of evidence found, never a verdict on the person: no total, no ranking, no coverage sort
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RoleTable } from "@/app/_components/role-table";
import type { RoleGroup } from "@/domain/role-overview";
import { BTN_PRIMARY, CARD, Eyebrow, LINK } from "../ui";

type Load =
  | { kind: "loading" }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string }
  | { kind: "ready"; groups: RoleGroup[] };

function RoleList({ groups }: { groups: RoleGroup[] }): React.JSX.Element {
  if (groups.length === 0) return <p className="text-muted">No briefs with a role yet.</p>;
  return (
    <ul className="divide-y divide-divider border-b border-divider">
      {groups.map((g) => (
        <li key={g.key}>
          <Link href={`/roles/${encodeURIComponent(g.key)}`} className="group -mx-3 flex min-h-11 items-center justify-between gap-4 rounded-lg px-3 py-4 hover:bg-surface">
            <span className="font-serif text-xl group-hover:text-action">{g.role}</span>
            <span className="shrink-0 text-sm text-muted tabular-nums">
              {g.run_count} {g.run_count === 1 ? "brief" : "briefs"}
            </span>
            <span aria-hidden="true" className="text-muted group-hover:text-action">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** GET /api/roles with the session cookie; a 401 means the visitor is not logged in. */
async function loadRoles(): Promise<Load> {
  try {
    const res = await fetch("/api/roles", { cache: "no-store" });
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) return { kind: "error", message: "We could not load the roles. Please try again." };
    const { groups } = await res.json<{ groups: RoleGroup[] }>();
    return { kind: "ready", groups };
  } catch {
    return { kind: "error", message: "We could not reach the service. Please try again." };
  }
}

export function RolesView({ roleKey }: { roleKey?: string }): React.JSX.Element {
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void loadRoles().then((next) => {
      if (live) setLoad(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const group = load.kind === "ready" && roleKey !== undefined ? load.groups.find((g) => g.key === roleKey) : undefined;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Roles</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Candidates by role</h1>
        <p className="max-w-[62ch] text-muted">Compare the briefs made for the same role.</p>
        {roleKey !== undefined && load.kind === "ready" && (
          <Link href="/roles" className={`${LINK} text-sm`}>All roles</Link>
        )}
      </header>
      {load.kind === "loading" && (
        <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-3">
          <div className="h-8 w-1/3 rounded bg-divider" />
          <div className="h-4 w-1/2 rounded bg-divider" />
        </div>
      )}
      {load.kind === "unauthorized" && (
        <div className={`${CARD} flex w-full max-w-md flex-col items-start gap-3`}>
          <h2 className="text-base font-semibold">Log in to see your team&apos;s roles</h2>
          <p className="text-sm text-muted">Roles and their briefs are visible only to your organization.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className={BTN_PRIMARY}>Log in</Link>
            <Link href="/register" className={`${LINK} text-sm`}>Create an account</Link>
          </div>
        </div>
      )}
      {load.kind === "error" && <p className="text-conflict">{load.message}</p>}
      {load.kind === "ready" && roleKey === undefined && <RoleList groups={load.groups} />}
      {load.kind === "ready" && roleKey !== undefined && (group === undefined ? <p className="text-muted">No briefs for this role.</p> : <RoleTable group={group} />)}
    </main>
  );
}
