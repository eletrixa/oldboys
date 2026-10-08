/**
 * Candidates overview per role (idea #16): list of roles, or one role's evidence table.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/roles/roles-view.tsx
 * Deps:    next/link, src/domain/role-overview, src/app/ui, src/app/_components (useAuthedJson, AuthStates, RoleTable)
 * Tested:  builder in src/domain/__tests__/role-overview.test.ts; view n/a
 *
 * Key responsibilities:
 * - Ask once for the operator token (RUN_TOKEN), keep it in sessionStorage, GET /api/roles with it (useAuthedJson)
 * - No roleKey: roles with run counts; roleKey: rows = runs newest first, columns = must-haves + sources confirmed
 *
 * Design constraints:
 * - Client component; the token never leaves sessionStorage except as the Authorization header
 * - Radar design (docs/design/radar-ui.md): semantic tokens and src/app/ui.tsx classes only
 * - Shows the amount of evidence found, never a verdict on the person: no total, no ranking, no coverage sort
 */
"use client";

import Link from "next/link";
import { AuthStates } from "@/app/_components/auth-states";
import { DISCLAIMER, RoleTable } from "@/app/_components/role-table";
import { useAuthedJson } from "@/app/_components/use-authed-json";
import type { RoleGroup } from "@/domain/role-overview";
import { BTN_QUIET, Eyebrow } from "../ui";

const ROLES_HINT = "The list shows every brief, so it needs the team token. Kept only in this tab.";

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

export function RolesView({ roleKey }: { roleKey?: string }): React.JSX.Element {
  const { state, submitToken } = useAuthedJson<{ groups: RoleGroup[] }>("/api/roles");

  const group = state.kind === "ready" && roleKey !== undefined ? state.data.groups.find((g) => g.key === roleKey) : undefined;

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
      <AuthStates state={state} onToken={submitToken} hint={ROLES_HINT} submitLabel="Show roles" />
      {state.kind === "ready" && roleKey === undefined && <RoleList groups={state.data.groups} />}
      {state.kind === "ready" && roleKey !== undefined && (group === undefined ? <p className="text-muted">No briefs for this role.</p> : <RoleTable group={group} />)}
    </main>
  );
}
