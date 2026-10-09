/**
 * New brief wizard (plans/012 step 3): position, candidates, research, as three cards on one page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/new/new-brief-wizard.tsx
 * Deps:    react, next/navigation, src/app/ui, src/app/_components/{token,run-tray-store}, src/app/positions/pool-rows (enrichSummary), ./{position-step,candidates-step,brief-rows}
 * Tested:  helpers in src/app/briefs/new/__tests__/brief-rows.test.ts; flow by e2e/brief-flow.spec.ts
 *
 * Key responsibilities:
 * - Picking a position loads GET /api/positions/:id for its must-haves and pool
 * - Research: each ready row goes to POST /api/positions/:id/candidates (JSON) or .../candidates/file (multipart), then one
 *   POST /api/positions/:id/enrich with the new ids plus the ticked pool ids; success routes to /positions/:id#candidates
 * - A refusal (429 cap, 401, other) shows calm copy and keeps every row; a retry re-adds rows as duplicates, which keep their id
 *
 * Design constraints:
 * - Client component; research starts only on the button click (it spends budget); no ranking of candidates
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackRun } from "@/app/_components/run-tray-store";
import { authFetch, postJson, readToken } from "@/app/_components/token";
import type { PositionDetail } from "@/app/api/positions/handler";
import { enrichSummary, type EnrichResponse } from "@/app/positions/pool-rows";
import { BTN_PRIMARY, CARD, Eyebrow } from "@/app/ui";
import type { PositionListItem } from "@/domain/position";
import type { RoleOption } from "@/domain/role-catalog";
import { candidateBody, type DraftRow, emptyRow, enrichIds, failText, patchRow, researchCount, rowReady } from "./brief-rows";
import { CandidatesStep } from "./candidates-step";
import { PositionStep } from "./position-step";

type Props = { positions: readonly PositionListItem[]; roleOptions: readonly RoleOption[]; initialPositionId: string | null };
type Added = { applicationId?: string };

/** Add one row to the pool; the application id, or the HTTP status of the refusal. */
async function addRow(positionId: string, row: DraftRow): Promise<string | number> {
  const base = `/api/positions/${encodeURIComponent(positionId)}/candidates`;
  const body = candidateBody(row);
  let res: Response;
  if (body !== null) {
    res = await postJson(base, body);
  } else {
    const form = new FormData();
    if (row.file !== null) form.set("cv", row.file);
    res = await authFetch(`${base}/file`, readToken(), { method: "POST", body: form });
  }
  if (!res.ok) return res.status;
  const out = await res.json<Added>().catch((): Added => ({}));
  return out.applicationId ?? 500;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section aria-labelledby={`step-${String(n)}`} className={`${CARD} flex flex-col gap-5 md:p-8`}>
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-xl text-action tabular-nums">{n}</span>
        <h2 id={`step-${String(n)}`} className="text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function NewBriefWizard({ positions, roleOptions, initialPositionId }: Props): React.JSX.Element {
  const router = useRouter();
  const nextKey = useRef(2);
  const [positionId, setPositionId] = useState(initialPositionId);
  const [title, setTitle] = useState(() => positions.find((p) => p.id === initialPositionId)?.title ?? "Position");
  const [detail, setDetail] = useState<PositionDetail | null>(null);
  const [rows, setRows] = useState<readonly DraftRow[]>([emptyRow("r1")]);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const count = researchCount(rows, ticked);

  useEffect(() => {
    if (positionId === null) return;
    let live = true;
    void authFetch(`/api/positions/${encodeURIComponent(positionId)}`, readToken())
      .then((res) => (res.ok ? res.json<PositionDetail>() : null))
      .catch(() => null)
      .then((d) => {
        if (!live) return;
        if (d === null) setNotice("We could not load this position. Pick it again or reload the page.");
        else setDetail(d);
      });
    return () => { live = false; };
  }, [positionId]);

  const pick = (id: string, name: string): void => {
    setPositionId(id);
    setTitle(name);
    setDetail(null);
    setTicked(new Set());
    setNotice(null);
  };
  const onPatch = useCallback((key: string, patch: Partial<Omit<DraftRow, "key">>) => { setRows((rs) => patchRow(rs, key, patch)); }, []);
  const onAdd = (): void => { setRows((rs) => [...rs, emptyRow(`r${String(nextKey.current++)}`)]); };
  const onRemove = (key: string): void => { setRows((rs) => rs.filter((r) => r.key !== key)); };
  const onTick = (id: string): void => {
    setTicked((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };

  async function research(): Promise<void> {
    if (positionId === null || count === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const added: string[] = [];
      for (const [i, row] of rows.entries()) {
        if (!rowReady(row)) continue;
        const got = await addRow(positionId, row);
        if (typeof got === "number") {
          setNotice(failText(got, `Candidate ${String(i + 1)} could not be added. Check it and try again.`));
          return;
        }
        added.push(got);
      }
      const res = await postJson(`/api/positions/${encodeURIComponent(positionId)}/enrich`, { applicationIds: enrichIds(added, ticked) });
      if (!res.ok) {
        setNotice(failText(res.status, "We could not start the research. Please try again."));
        return;
      }
      const out = await res.json<EnrichResponse>();
      for (const run of out.started) trackRun(run.runId);
      if (out.started.length === 0) {
        setNotice(enrichSummary(out));
        return;
      }
      router.push(`/positions/${encodeURIComponent(positionId)}#candidates`);
    } catch {
      setNotice("We could not reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const chosen = positionId === null ? null : { id: positionId, title: detail?.position.title ?? title, mustHaves: detail?.position.must_haves ?? null };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>New brief</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Who are you hiring?</h1>
        <p className="text-muted">Pick the position, add one or more candidates, and start the research for all of them at once.</p>
      </header>
      <Step n={1} title="Position">
        <PositionStep positions={positions} roleOptions={roleOptions} chosen={chosen} onPick={pick} onChange={() => { setPositionId(null); setDetail(null); }} />
      </Step>
      {chosen !== null && (
        <>
          <Step n={2} title="Candidates">
            <CandidatesStep rows={rows} pool={detail?.candidates ?? []} ticked={ticked} onPatch={onPatch} onAdd={onAdd} onRemove={onRemove} onTick={onTick} />
          </Step>
          <Step n={3} title="Research">
            <p className="text-sm text-muted">One brief per candidate, each with a source for every point. You can follow them in the results table.</p>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className={BTN_PRIMARY} disabled={busy || count === 0} onClick={() => void research()}>
                {busy ? "Starting…" : `Research ${String(count)} ${count === 1 ? "candidate" : "candidates"}`}
              </button>
              {notice !== null && <p role="status" className="text-sm text-conflict">{notice}</p>}
            </div>
          </Step>
        </>
      )}
      {chosen === null && notice !== null && <p role="status" className="text-sm text-conflict">{notice}</p>}
    </main>
  );
}
