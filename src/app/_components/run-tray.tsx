/**
 * Run tray: a docked panel that follows the runs started in this tab, so the recruiter can keep using the site.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/run-tray.tsx
 * Deps:    react, next/link, next/navigation, src/app/ui, src/domain/run-eta, ./run-tray-store, ./use-now, src/app/runs/[id]/state (type), src/app/runs/[id]/progress-text (trayLine)
 * Tested:  helpers in ./__tests__/run-tray-store.test.ts; view n/a (QA in the browser)
 *
 * Key responsibilities:
 * - Mounted once in the root layout; reads the tray list from sessionStorage and re-reads on TRAY_EVENT
 * - Polls GET /api/runs/:id/state every 4 s for every live run, stops per run once it is done or failed
 * - Each row: name, what it is hiring for, status pill, a progress bar and five step dots, one line with the remaining
 *   time range and what is read now (plans/015, ticking once a second), "Answer now" when the run waits for the
 *   recruiter, Open brief link, dismiss
 * - Side toggle (left or right, remembered in localStorage) and collapse to a small pill
 *
 * Design constraints:
 * - Hidden when the tray is empty, on candidate pages (/apply/<tag>) and on a run page for that run (the open run is neither listed nor polled)
 * - Never blocks the page: fixed, narrow, scrolls inside itself; keyboard reachable (buttons and links only); an in-flow
 *   spacer as tall as the tray ends the page, so the last button (e.g. "Research N candidates" on a phone) scrolls above it
 * - Shows progress and status, never a verdict on a person
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { progressView } from "@/domain/run-eta";
import { trayLine } from "@/app/runs/[id]/progress-text";
import type { RunState } from "@/app/runs/[id]/state";
import { LINK, Pill } from "@/app/ui";
import { readTray, TRAY_EVENT, type TrayRow, trayRow, untrackRun } from "./run-tray-store";
import { useNow } from "./use-now";

const POLL_MS = 4000;
const SIDE_KEY = "oldboys.traySide";
type Side = "left" | "right";

const DOT: Readonly<Record<TrayRow["dots"][number], string>> = {
  done: "bg-ok",
  active: "bg-action animate-pulse",
  todo: "bg-line",
  failed: "bg-conflict",
  skipped: "bg-divider",
};

function readSide(): Side {
  try {
    return localStorage.getItem(SIDE_KEY) === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}

function useTrayIds(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = (): void => {
      setIds(readTray());
    };
    sync();
    window.addEventListener(TRAY_EVENT, sync);
    return () => {
      window.removeEventListener(TRAY_EVENT, sync);
    };
  }, []);
  return ids;
}

/** One poller per run: fetches state now and every POLL_MS while the run is live. */
function useRunRow(id: string): TrayRow | null {
  const [row, setRow] = useState<TrayRow | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/runs/${encodeURIComponent(id)}/state`, { cache: "no-store" });
        if (res.ok) {
          const next = trayRow(await res.json<RunState>(), Date.now());
          if (stopped) return;
          setRow(next);
          if (!next.live) return;
        }
      } catch {
        // Network blip: try again on the next tick.
      }
      if (!stopped) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [id]);
  return row;
}

function TrayItem({ id, onClose }: { id: string; onClose: () => void }): React.JSX.Element {
  const row = useRunRow(id);
  const nowMs = useNow(row?.live ?? false) - (row?.skew ?? 0);
  const view = row?.phases === null || row === null ? null : progressView(row.phases, row.raw_status, nowMs);
  const share = view === null ? (row?.progress ?? 0) : view.share;
  const line = view === null || row === null ? null : trayLine(view, { status: row.raw_status, created_at: row.created_at, cost: row.cost, mentions: row.mentions }, nowMs);
  const href = `/runs/${encodeURIComponent(id)}`;
  const paused = row?.raw_status === "paused";
  return (
    <li className="flex flex-col gap-2 border-t border-divider px-4 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={href} className="block truncate font-medium hover:underline">
            {row?.title ?? "New brief"}
          </Link>
          {row?.detail !== null && row?.detail !== undefined && <p className="truncate text-xs text-muted">{row.detail}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={`Stop following ${row?.title ?? "this brief"}`} className="-mt-2 -mr-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-muted hover:text-ink">
          ×
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-divider" aria-hidden="true">
        <div className={`h-full transition-[width] duration-700 ${row?.tone === "conflict" ? "bg-conflict" : row?.tone === "ok" ? "bg-ok" : "bg-action"}`} style={{ width: `${String(Math.max(3, Math.round(share * 100)))}%` }} />
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex items-center gap-1">
          {(row?.dots ?? ["todo", "todo", "todo", "todo", "todo"]).map((d, i) => (
            <span key={i} className={`inline-block size-2 rounded-full ${DOT[d]}`} />
          ))}
        </span>
        <Pill tone={row?.tone ?? "neutral"}>{row?.status ?? "Starting"}</Pill>
        <Link href={href} className={`${LINK} ml-auto text-sm`}>
          {paused ? "Answer now" : "Open brief"}
        </Link>
      </div>
      {line !== null && (
        <p className={`text-xs tabular-nums ${paused ? "text-ink" : view?.longer === true ? "text-unsure" : "text-muted"}`}>{line}</p>
      )}
    </li>
  );
}

export function RunTray(): React.JSX.Element | null {
  const pathname = usePathname();
  const ids = useTrayIds();
  // Lazy initialiser: the stored side is read once on the client; the server renders nothing (ids are empty there).
  const [side, setSide] = useState<Side>(() => (typeof window === "undefined" ? "right" : readSide()));
  const [open, setOpen] = useState(true);

  // The run whose page is open is already on screen: neither listed nor polled.
  const shown = ids.filter((id) => pathname !== `/runs/${id}`);
  if (shown.length === 0 || pathname.startsWith("/apply/")) return null;

  function flip(): void {
    const next: Side = side === "right" ? "left" : "right";
    setSide(next);
    try {
      localStorage.setItem(SIDE_KEY, next);
    } catch {
      // Storage blocked: the side resets next time.
    }
  }

  const dock = side === "right" ? "right-4" : "left-4";
  if (!open) {
    return (
      <>
        <TraySpacer height="4.5rem" />
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className={`fixed bottom-4 ${dock} z-40 rounded-full border border-line bg-surface px-4 py-2 text-sm shadow-lg hover:border-ink`}
        >
          Briefs in progress ({shown.length})
        </button>
      </>
    );
  }
  return (
    <>
      <TraySpacer height={`min(calc(50vh + 4rem), ${String(4 + 6 * shown.length)}rem)`} />
      <aside aria-label="Briefs in progress" className={`fixed bottom-4 ${dock} z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-lg`}>
        <div className="flex h-11 items-center justify-between gap-2 border-b border-divider bg-canvas pl-4 pr-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Briefs in progress</p>
          <div className="flex items-center text-xs">
            <button type="button" onClick={flip} className="min-h-11 px-2 text-muted hover:text-ink">
              {side === "right" ? "Move left" : "Move right"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
              }}
              className="min-h-11 px-2 text-muted hover:text-ink"
            >
              Hide
            </button>
          </div>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto">
          {shown.map((id) => (
            <TrayItem
              key={id}
              id={id}
              onClose={() => {
                untrackRun(id);
              }}
            />
          ))}
        </ul>
      </aside>
    </>
  );
}

/** In-flow space at the end of the page as tall as the docked tray, so the last button on a page can scroll above it. */
function TraySpacer({ height }: { height: string }): React.JSX.Element {
  return <div aria-hidden="true" className="shrink-0" style={{ height }} />;
}
