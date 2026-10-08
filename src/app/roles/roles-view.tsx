/**
 * Candidates overview per role (idea #16): list of roles, or one role's evidence table.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/roles/roles-view.tsx
 * Deps:    react, next/link, src/domain/role-overview, src/app/run-token
 * Tested:  builder in src/domain/__tests__/role-overview.test.ts; view n/a
 *
 * Key responsibilities:
 * - Ask once for the operator token (RUN_TOKEN), keep it in sessionStorage, GET /api/roles with it
 * - No roleKey: roles with run counts; roleKey: rows = runs newest first, columns = must-haves + sources confirmed
 *
 * Design constraints:
 * - Client component; the token never leaves sessionStorage except as the Authorization header
 * - Shows the amount of evidence found, never a verdict on the person: no total, no ranking, no coverage sort
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TokenForm, readToken, writeToken } from "@/app/run-token";
import type { CoverageLabel, RoleGroup } from "@/domain/role-overview";

const DISCLAIMER = "This table shows how much public evidence the research found, not how good a candidate is.";

const CELL_STYLE: Readonly<Record<CoverageLabel, string>> = {
  documented: "text-teal-300",
  partial: "text-amber-300",
  "no evidence": "text-zinc-400",
  "not checked": "text-zinc-500 italic",
};

type Load =
  | { kind: "loading" }
  | { kind: "token"; error: string | null }
  | { kind: "error"; message: string }
  | { kind: "ready"; groups: RoleGroup[] };

function RoleList({ groups }: { groups: RoleGroup[] }): React.JSX.Element {
  if (groups.length === 0) return <p className="text-zinc-400">No briefs with a role yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-zinc-800 rounded-xl border border-zinc-800">
      {groups.map((g) => (
        <li key={g.key}>
          <Link href={`/roles/${encodeURIComponent(g.key)}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-900">
            <span className="font-medium">{g.role}</span>
            <span className="shrink-0 text-sm text-zinc-400">
              {g.run_count} {g.run_count === 1 ? "brief" : "briefs"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RoleTable({ group }: { group: RoleGroup }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{group.role}</h2>
      <p className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">{DISCLAIMER}</p>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Evidence found per must-have for {group.role}, newest brief first</caption>
          <thead className="bg-zinc-900 text-xs text-zinc-400">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Person</th>
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              {group.questions.map((q) => (
                <th key={q} scope="col" className="min-w-40 px-3 py-2 font-medium">{q}</th>
              ))}
              <th scope="col" className="px-3 py-2 font-medium">Sources confirmed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {group.runs.map((run) => (
              <tr key={run.id}>
                <th scope="row" className="px-3 py-2 font-medium">
                  <Link href={`/runs/${run.id}`} className="text-teal-300 underline-offset-2 hover:underline">{run.subject}</Link>
                </th>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{run.created_at.slice(0, 10)}</td>
                <td className="px-3 py-2 text-zinc-400">{run.status}</td>
                {run.cells.map((label, i) => (
                  <td key={group.questions[i] ?? i} className={`px-3 py-2 ${CELL_STYLE[label]}`}>{label}</td>
                ))}
                <td className="px-3 py-2 text-zinc-300">{run.sources_confirmed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        &quot;Not checked&quot; means the brief is missing, ran without the AI summary, or did not ask this question. Only sources tied to a confirmed profile are counted.
      </p>
    </div>
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
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Candidates by role</h1>
        <p className="text-zinc-400">Compare the briefs made for the same role. {DISCLAIMER}</p>
        {roleKey !== undefined && (
          <Link href="/roles" className="text-sm text-zinc-400 hover:text-zinc-200">All roles</Link>
        )}
      </header>
      {load.kind === "loading" && <p className="text-zinc-400">Loading…</p>}
      {load.kind === "token" && <TokenForm error={load.error} hint="The list shows every brief, so it needs the team token. Kept only in this tab." submitLabel="Show roles" onSubmit={submitToken} />}
      {load.kind === "error" && <p className="text-red-300">{load.message}</p>}
      {load.kind === "ready" && roleKey === undefined && <RoleList groups={load.groups} />}
      {load.kind === "ready" && roleKey !== undefined && (group === undefined ? <p className="text-zinc-400">No briefs for this role.</p> : <RoleTable group={group} />)}
    </main>
  );
}
