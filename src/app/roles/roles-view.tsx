/**
 * Candidates overview per role (idea #16): list of roles, or one role's evidence table.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/roles/roles-view.tsx
 * Deps:    react, next/link, src/domain/role-overview, src/app/ui
 * Tested:  builder in src/domain/__tests__/role-overview.test.ts; view n/a
 *
 * Key responsibilities:
 * - GET /api/roles with the session cookie (scoped to the organization); 401 shows a log-in prompt
 * - No roleKey: roles with run counts; roleKey: rows = runs newest first, columns = must-haves + sources confirmed
 *
 * Design constraints:
 * - Client component; no token handling, the session cookie travels by default
 * - Radar design (docs/design/radar-ui.md): semantic tokens and src/app/ui.tsx classes only
 * - Shows the amount of evidence found, never a verdict on the person: no total, no ranking, no coverage sort
 */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CoverageLabel, RoleGroup } from "@/domain/role-overview";
import { BTN_QUIET, CARD, CARD_SAGE, Eyebrow, LINK } from "../ui";

const DISCLAIMER = "This table shows how much public evidence the research found, not how good a candidate is.";

const CELL_STYLE: Readonly<Record<CoverageLabel, { text: string; dot: string }>> = {
  documented: { text: "text-ok", dot: "bg-ok" },
  partial: { text: "text-unsure", dot: "bg-unsure" },
  "no evidence": { text: "text-muted", dot: "bg-line" },
  "not checked": { text: "text-muted italic", dot: "bg-divider" },
};

type Load =
  | { kind: "loading" }
  | { kind: "unauthorized" }
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

function RoleTable({ group }: { group: RoleGroup }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl">{group.role}</h2>
      <p className={`${CARD_SAGE} text-sm`}>{DISCLAIMER}</p>
      <div className={`${CARD} overflow-hidden p-0 md:p-0`}>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Evidence found per must-have for {group.role}, newest brief first</caption>
          <thead className="bg-canvas text-xs font-semibold tracking-[0.08em] text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Person</th>
              <th scope="col" className="px-4 py-3 font-semibold">Date</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              {group.questions.map((q) => (
                <th key={q} scope="col" className="min-w-40 px-4 py-3 font-semibold">{q}</th>
              ))}
              <th scope="col" className="px-4 py-3 font-semibold">Sources confirmed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {group.runs.map((run) => (
              <tr key={run.id}>
                <th scope="row" className="px-4 py-3">
                  <Link href={`/runs/${run.id}`} className={LINK}>{run.subject}</Link>
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-muted tabular-nums">{run.created_at.slice(0, 10)}</td>
                <td className="px-4 py-3 text-muted tabular-nums">{run.status}</td>
                {run.cells.map((label, i) => (
                  <td key={group.questions[i] ?? i} className={`px-4 py-3 ${CELL_STYLE[label].text}`}>
                    <span aria-hidden="true" className={`mr-2 inline-block size-2 rounded-full ${CELL_STYLE[label].dot}`} />
                    {label}
                  </td>
                ))}
                <td className="px-4 py-3 tabular-nums">{run.sources_confirmed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-xs text-muted">
        &quot;Not checked&quot; means the brief is missing, ran without the AI summary, or did not ask this question. Only sources tied to a confirmed profile are counted.
      </p>
    </div>
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
      {load.kind === "unauthorized" && (
        <p className="text-muted">
          <Link href="/login" className={LINK}>Log in</Link> to see your team&apos;s roles.
        </p>
      )}
      {load.kind === "error" && <p className="text-conflict">{load.message}</p>}
      {load.kind === "ready" && roleKey === undefined && <RoleList groups={load.groups} />}
      {load.kind === "ready" && roleKey !== undefined && (group === undefined ? <p className="text-muted">No briefs for this role.</p> : <RoleTable group={group} />)}
    </main>
  );
}
