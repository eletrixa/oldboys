/**
 * Run tray: a docked panel that follows the runs started in this tab, so the recruiter can keep using the site.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/run-tray.tsx
 * Deps:    react, next/link, next/navigation, src/app/ui, ./run-tray-store, src/app/runs/[id]/state (type)
 * Tested:  helpers in ./__tests__/run-tray-store.test.ts; view n/a (QA in the browser)
 *
 * Key responsibilities:
 * - Mounted once in the root layout; reads the tray list from sessionStorage and re-reads on TRAY_EVENT
 * - Polls GET /api/runs/:id/state every 4 s for every live run, stops per run once it is done or failed; a 404 (run
 *   deleted) untracks the run so a deleted brief does not sit in the tray as "Starting"
 * - Each row: name, what it is hiring for, status pill, five step dots, Open brief link, dismiss
 * - Side toggle (left or right, remembered in localStorage) and collapse to a small pill
 *
 * Design constraints:
 * - Hidden when the tray is empty, on candidate pages (/apply/<tag>) and on the run page of the only run it holds
 * - Never blocks the page: fixed, narrow, scrolls inside itself; keyboard reachable (buttons and links only); an in-flow
 *   spacer as tall as the tray ends the page, so the last button (e.g. "Research N candidates" on a phone) scrolls above it
 * - Shows progress and status, never a verdict on a person
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { RunState } from "@/app/runs/[id]/state";
import { LINK, Pill } from "@/app/ui";
import { readTray, TRAY_EVENT, type TrayRow, trayRow, untrackRun } from "./run-tray-store";

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
        if (res.status === 404) {
          // The run was deleted (or never existed): drop it instead of showing "Starting" forever.
          if (!stopped) untrackRun(id);
          return;
        }
        if (res.ok) {
          const next = trayRow(await res.json<RunState>());
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
  return (
    <li className="flex flex-col gap-2 border-t border-divider px-4 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/runs/${encodeURIComponent(id)}`} className="block truncate font-medium hover:underline">
            {row?.title ?? "New brief"}
          </Link>
          {row?.detail !== null && row?.detail !== undefined && <p className="truncate text-xs text-muted">{row.detail}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={`Stop following ${row?.title ?? "this brief"}`} className="-mt-2 -mr-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-muted hover:text-ink">
          ×
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex items-center gap-1">
          {(row?.dots ?? ["todo", "todo", "todo", "todo", "todo"]).map((d, i) => (
            <span key={i} className={`inline-block size-2 rounded-full ${DOT[d]}`} />
          ))}
        </span>
        <Pill tone={row?.tone ?? "neutral"}>{row?.status ?? "Starting"}</Pill>
        <Link href={`/runs/${encodeURIComponent(id)}`} className={`${LINK} ml-auto text-sm`}>
          Open brief
        </Link>
      </div>
    </li>
  );
}

export function RunTray(): React.JSX.Element | null {
  const pathname = usePathname();
  const ids = useTrayIds();
  // Lazy initialiser: the stored side is read once on the client; the server renders nothing (ids are empty there).
  const [side, setSide] = useState<Side>(() => (typeof window === "undefined" ? "right" : readSide()));
  const [open, setOpen] = useState(true);

  if (ids.length === 0 || pathname.startsWith("/apply/")) return null;
  if (ids.length === 1 && pathname === `/runs/${ids[0] ?? ""}`) return null;

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
          Briefs in progress ({ids.length})
        </button>
      </>
    );
  }
  return (
    <>
      <TraySpacer height={`min(calc(50vh + 4rem), ${String(4 + 6 * ids.length)}rem)`} />
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
          {ids.map((id) => (
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
