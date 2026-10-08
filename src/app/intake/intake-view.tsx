/**
 * Operator view of the intake queue: applications newest first, and the position tags with a create form.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/intake/intake-view.tsx
 * Deps:    react, src/app/_lib/operator-token, ./intake-rows, ./intake-tables, ./tag-form
 * Tested:  helpers in src/app/intake/__tests__/intake-rows.test.ts; view n/a
 *
 * Key responsibilities:
 * - Ask once for the operator token (RUN_TOKEN) via the shared module; GET /api/intake/applications and /api/intake/tags with it
 * - Applications table and tags table (./intake-tables) plus TagForm; a created tag refreshes both lists
 *
 * Design constraints:
 * - Client component; the token never leaves sessionStorage except as the Authorization header
 * - A queue, not a dossier: no CV text, no ranking, no score, no verdict on a person
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGated, type Gated, readToken, TokenForm } from "@/app/_lib/operator-token";
import { type ApplicationListRow, shapeRow, type TagRow } from "./intake-rows";
import { ApplicationsTable, TagsTable } from "./intake-tables";
import { TagForm } from "./tag-form";

type Data = { applications: ApplicationListRow[]; tags: TagRow[] };

async function loadIntake(token: string | null): Promise<Gated<Data>> {
  const [apps, tags] = await Promise.all([
    fetchGated<{ applications: ApplicationListRow[] }>("/api/intake/applications", token, "the applications"),
    fetchGated<{ tags: TagRow[] }>("/api/intake/tags", token, "the tags"),
  ]);
  if (apps.kind !== "ready") return apps;
  if (tags.kind !== "ready") return tags;
  return { kind: "ready", data: { applications: apps.data.applications, tags: tags.data.tags } };
}

export function IntakeView(): React.JSX.Element {
  const [load, setLoad] = useState<Gated<Data>>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void loadIntake(readToken()).then((next) => {
      if (live) setLoad(next);
    });
    return () => {
      live = false;
    };
  }, []);

  function submitToken(token: string): void {
    setLoad({ kind: "loading" });
    void loadIntake(token).then(setLoad);
  }

  const refresh = useCallback(() => {
    void loadIntake(readToken()).then(setLoad);
  }, []);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted">
          Everything that arrived by email, form, apply page or StartupJobs, newest first. This is a queue of what came in, not a ranking of people.
        </p>
      </header>
      {load.kind === "loading" && <p className="text-muted">Loading…</p>}
      {load.kind === "token" && (
        <TokenForm error={load.error} helper="The queue lists applicants, so it needs the team token. Kept only in this tab." button="Show applications" onSubmit={submitToken} />
      )}
      {load.kind === "error" && <p className="text-conflict">{load.message}</p>}
      {load.kind === "ready" && (
        <>
          <ApplicationsTable rows={load.data.applications.map(shapeRow)} />
          <section className="flex flex-col gap-3" aria-labelledby="tags-heading">
            <h2 id="tags-heading" className="text-2xl">Position tags</h2>
            <p className="text-sm text-muted">A tag routes an application to a role: jobs+&lt;tag&gt;@asajj.cz, /apply/&lt;tag&gt;, the form&apos;s hidden field or a StartupJobs offer.</p>
            <TagsTable tags={load.data.tags} />
            <TagForm onCreated={refresh} />
          </section>
        </>
      )}
    </main>
  );
}
