/**
 * Candidates overview per role (idea #16): list of roles, or one role's evidence table.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/roles/roles-view.tsx
 * Deps:    react, next/link, src/domain/role-overview, src/app/ui, src/app/_components (token, TokenForm, RoleTable)
 * Tested:  builder in src/domain/__tests__/role-overview.test.ts; view n/a
 *
 * Key responsibilities:
 * - Ask once for the operator token (RUN_TOKEN), keep it in sessionStorage, GET /api/roles with it
 * - No roleKey: roles with run counts; roleKey: rows = runs newest first, columns = must-haves + sources confirmed
 *
 * Design constraints:
 * - Client component; the token never leaves sessionStorage except as the Authorization header
 * - Radar design (docs/design/radar-ui.md): semantic tokens and src/app/ui.tsx classes only
 * - Shows the amount of evidence found, never a verdict on the person: no total, no ranking, no coverage sort
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DISCLAIMER, RoleTable } from "@/app/_components/role-table";
import { readToken, writeToken } from "@/app/_components/token";
import { TokenForm } from "@/app/_components/token-form";
import type { RoleGroup } from "@/domain/role-overview";
import { BTN_QUIET, Eyebrow } from "../ui";

type Load =
  | { kind: "loading" }
  | { kind: "token"; error: string | null }
  | { kind: "error"; message: string }
  | { kind: "ready"; groups: RoleGroup[] };

function RoleList({ groups }: { groups: RoleGroup[] }): React.JSX.Element {
  if (groups.length === 0) return <p className="text-muted">No briefs with a role yet.</p>;
  return (
    <ul className="divide-y divide-divider">
      {groups.map((g) => (
        <li key={g.key}>
          <Link href={`/roles/${encodeURIComponent(g.key)}`} className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-4 hover:bg-sage/40">
            <span className="font-serif text-xl">{g.role}</span>
            <span className="shrink-0 text-sm text-muted tabular-nums">
              {g.run_count} {g.run_count === 1 ? "brief" : "briefs"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** GET /api/roles; without a token the request still goes out and its 401 shows the token form. */
async function loadRoles(token: string | null): Promise<Load> {
  try {
    const headers: HeadersInit = token === null ? {} : { Authorization: `Bearer ${token}` };
    const res = await fetch("/api/roles", { headers, cache: "no-store" });
    if (res.status === 401) {
      writeToken(null);
      return { kind: "token", error: token === null ? null : "That token did not work. Please try again." };
    }
    if (!res.ok) return { kind: "error", message: "We could not load the roles. Please try again." };
    const { groups } = await res.json<{ groups: RoleGroup[] }>();
    if (token !== null) writeToken(token);
    return { kind: "ready", groups };
  } catch {
    return { kind: "error", message: "We could not reach the service. Please try again." };
  }
}

export function RolesView({ roleKey }: { roleKey?: string }): React.JSX.Element {
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void loadRoles(readToken()).then((next) => {
      if (live) setLoad(next);
    });
    return () => {
      live = false;
    };
  }, []);

  function submitToken(token: string): void {
    setLoad({ kind: "loading" });
    void loadRoles(token).then(setLoad);
  }

  const group = load.kind === "ready" && roleKey !== undefined ? load.groups.find((g) => g.key === roleKey) : undefined;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Roles</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Candidates by role</h1>
        <p className="text-muted">Compare the briefs made for the same role. {DISCLAIMER}</p>
        {roleKey !== undefined && (
          <Link href="/roles" className={BTN_QUIET}>All roles</Link>
        )}
      </header>
      {load.kind === "loading" && (
        <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-3">
          <div className="h-8 w-1/3 rounded bg-divider" />
          <div className="h-4 w-1/2 rounded bg-divider" />
        </div>
      )}
      {load.kind === "token" && <TokenForm error={load.error} onSubmit={submitToken} />}
      {load.kind === "error" && <p className="text-conflict">{load.message}</p>}
      {load.kind === "ready" && roleKey === undefined && <RoleList groups={load.groups} />}
      {load.kind === "ready" && roleKey !== undefined && (group === undefined ? <p className="text-muted">No briefs for this role.</p> : <RoleTable group={group} />)}
    </main>
  );
}
