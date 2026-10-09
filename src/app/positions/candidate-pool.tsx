/**
 * Candidates of a position: add a person by hand, the results table (status, fit, independent evidence, profile link), start research.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/candidate-pool.tsx
 * Deps:    react, next/link, src/app/ui, src/app/_components/{token (postJson), run-tray-store (trackRun)}, ./pool-rows
 * Tested:  shaping in src/app/positions/__tests__/pool-rows.test.ts; view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - POST /api/positions/:id/candidates from the add form (needs a LinkedIn URL or CV text)
 * - Results table in added order (anchor #candidates) with a checkbox only for rows that can start; POST /api/positions/:id/enrich
 * - Table sits in a focusable labelled region with a swipe hint under md; errors announce as alerts, confirmations as status
 * - Report started runs and skipped reasons, follow them in the run tray, then ask the page to reload the detail
 * - While any row is researching, re-GET the position detail every 5 s through onReload (one request for all rows)
 *
 * Design constraints:
 * - Client component; no ranking or verdict on a person, never sorted by fit (fit is the evidence share of the must-haves)
 * - Research starts only on the button click (it spends budget)
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { trackRun } from "@/app/_components/run-tray-store";
import { postJson } from "@/app/_components/token";
import type { PoolRow } from "@/app/api/positions/handler";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, FIELD, LINK, Pill } from "@/app/ui";
import { enrichSummary, type EnrichResponse, shapePool } from "./pool-rows";

const POLL_MS = 5000;

type Props = { positionId: string; rows: PoolRow[]; onReload: () => Promise<void> };
type Notice = { kind: "ok" | "error"; text: string } | null;

function failText(status: number, fallback: string): string {
  if (status === 401) return "You are logged out. Reload the page to log in again.";
  if (status === 429) return "The hourly run limit is reached. Try again later.";
  return fallback;
}

/** Errors announce at once (alert); confirmations wait politely (status). */
function NoticeLine({ notice }: { notice: Notice }): React.JSX.Element {
  const error = notice?.kind === "error";
  return <span role={error ? "alert" : "status"} className={`text-sm ${error ? "text-conflict" : "text-muted"}`}>{notice?.text}</span>;
}

function AddCandidate({ positionId, onReload }: Pick<Props, "positionId" | "onReload">): React.JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [cv, setCv] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const ready = linkedin.trim() !== "" || cv.trim() !== "";

  async function submit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const body = {
      ...(name.trim() !== "" && { name: name.trim() }),
      ...(email.trim() !== "" && { email: email.trim() }),
      ...(linkedin.trim() !== "" && { linkedinUrl: linkedin.trim() }),
      ...(cv.trim() !== "" && { cvText: cv.trim() }),
    };
    try {
      const res = await postJson(`/api/positions/${encodeURIComponent(positionId)}/candidates`, body);
      if (!res.ok) {
        setNotice({ kind: "error", text: failText(res.status, "We could not add this person. Check the fields and try again.") });
        return;
      }
      const out = await res.json<{ duplicate?: boolean; status?: string; note?: string | null }>();
      const text = out.duplicate === true ? "Already in the pool." : out.status === "incomplete" ? (out.note ?? "Added, but the LinkedIn URL or CV could not be read.") : "Added to the pool.";
      setNotice({ kind: "ok", text });
      if (out.duplicate !== true) {
        setName("");
        setEmail("");
        setLinkedin("");
        setCv("");
      }
      await onReload();
    } catch {
      setNotice({ kind: "error", text: "We could not reach the service. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={`${CARD} flex flex-col gap-3`} aria-label="Add a candidate">
      <h3 className="font-medium">Add a candidate</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Name (optional)
          <input className={`${FIELD} px-3 py-2`} value={name} maxLength={200} onChange={(e) => { setName(e.target.value); }} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Email (optional)
          <input type="email" className={`${FIELD} px-3 py-2`} value={email} onChange={(e) => { setEmail(e.target.value); }} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        LinkedIn URL
        <input className={`${FIELD} px-3 py-2`} value={linkedin} maxLength={500} placeholder="https://www.linkedin.com/in/…" onChange={(e) => { setLinkedin(e.target.value); }} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        CV text
        <textarea className={`${FIELD} px-3 py-2`} rows={4} value={cv} placeholder="Paste the CV if there is no LinkedIn URL" onChange={(e) => { setCv(e.target.value); }} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={BTN_SECONDARY} disabled={!ready || busy}>Add to pool</button>
        <NoticeLine notice={notice} />
      </div>
    </form>
  );
}

export function CandidatePool({ positionId, rows, onReload }: Props): React.JSX.Element {
  const views = useMemo(() => shapePool(rows), [rows]);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const chosen = views.filter((v) => v.selectable && picked.has(v.id)).map((v) => v.id);
  const researching = views.some((v) => v.researching);

  useEffect(() => {
    if (!researching) return;
    const timer = setInterval(() => void onReload(), POLL_MS);
    return () => { clearInterval(timer); };
  }, [researching, onReload]);

  function toggle(id: string): void {
    setPicked((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function enrich(): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      const res = await postJson(`/api/positions/${encodeURIComponent(positionId)}/enrich`, { applicationIds: chosen });
      if (!res.ok) {
        setNotice({ kind: "error", text: failText(res.status, "We could not start the research. Please try again.") });
        return;
      }
      const out = await res.json<EnrichResponse>();
      for (const run of out.started) trackRun(run.runId);
      setNotice({ kind: "ok", text: enrichSummary(out) });
      setPicked(new Set());
      await onReload();
    } catch {
      setNotice({ kind: "error", text: "We could not reach the service. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="candidates" aria-labelledby="pool-heading" className="flex scroll-mt-6 flex-col gap-4">
      <h2 id="pool-heading" className="font-serif text-2xl">Candidates</h2>
      <AddCandidate positionId={positionId} onReload={onReload} />
      {views.length === 0 ? (
        <p className="text-muted">No candidates yet. Add one above, or bind an intake channel so applications land here.</p>
      ) : (
        <>
          <div className="rounded-xl border border-divider bg-surface">
            <p className="px-4 pt-3 text-xs text-muted md:hidden">Swipe sideways to see every column.</p>
            <div role="region" aria-label="Candidates" tabIndex={0} className="relative overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Candidates in the order they were added; fit is the evidence share of this position&apos;s must-haves</caption>
              <thead className="bg-sage/50 text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Select</span></th>
                  <th scope="col" className="px-3 py-2 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2 font-medium">Source</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Fit</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Independent evidence</th>
                  <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Profile</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {views.map((v) => (
                  <tr key={v.id} className="align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${v.name}`}
                        disabled={!v.selectable}
                        checked={picked.has(v.id)}
                        onChange={() => { toggle(v.id); }}
                      />
                    </td>
                    <th scope="row" className="min-w-[10rem] px-3 py-2 font-medium">
                      {v.name}
                      {v.email !== null && <span className="block text-xs font-normal text-muted">{v.email}</span>}
                    </th>
                    <td className="whitespace-nowrap px-3 py-2">{v.source}</td>
                    <td className="px-3 py-2" title={v.note ?? undefined}><Pill tone={v.tone}>{v.status}</Pill></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{v.fit}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{v.independent}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {v.runHref === null ? <span className="text-muted">—</span> : <Link href={v.runHref} className={LINK}>Open profile</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_PRIMARY} disabled={chosen.length === 0 || busy} onClick={() => void enrich()}>
              Research selected ({chosen.length})
            </button>
            <NoticeLine notice={notice} />
          </div>
        </>
      )}
    </section>
  );
}
