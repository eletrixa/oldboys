/**
 * Tabs of the finished brief (Interview plan, Evidence, Phone screen, Sources and gaps) and the in-page navigation to them.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/brief-tabs.tsx
 * Deps:    react, ../../ui (Radar tokens)
 * Tested:  n/a (counts in __tests__/brief-layout.test.ts; keyboard and print checked in the browser)
 *
 * Key responsibilities:
 * - useBriefNav: the selected tab, kept in the URL hash (#plan, #evidence, #call, #sources; default plan), plus goToItem(n):
 *   open the plan, scroll to question n and flash it briefly (motion only without reduced motion, globals.css)
 * - TabBar: WAI-ARIA tablist (role tab, aria-selected, roving tabindex, arrow keys / Home / End), sticky on top of the main
 *   column, scrolls sideways on phones; each tab carries a count, the phone one in the unsure tone when answers are open
 * - TabPanel: every panel stays mounted (the phone panel keeps polling); inactive ones get `tab-inactive hidden`, and the
 *   print rule in globals.css prints every panel
 *
 * Design constraints:
 * - Client only; the hash is read with useSyncExternalStore (server snapshot = plan) so hydration stays clean
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type TabKey = "plan" | "evidence" | "call" | "sources";
export const TAB_KEYS: readonly TabKey[] = ["plan", "evidence", "call", "sources"];

const isTab = (s: string): s is TabKey => (TAB_KEYS as readonly string[]).includes(s);

export type BriefNav = { tab: TabKey; openTab: (t: TabKey) => void; goToItem: (n: number) => void };

export const BriefNavContext = createContext<BriefNav>({ tab: "plan", openTab: () => undefined, goToItem: () => undefined });

export const useNav = (): BriefNav => useContext(BriefNavContext);

const FLASH_MS = 1600;

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
  };
};
const hashTab = (): TabKey => {
  const h = window.location.hash.slice(1);
  return isTab(h) ? h : "plan";
};
const serverTab = (): TabKey => "plan";

/** Sets the hash without a history entry and tells the subscribers (replaceState fires no hashchange). */
function setHash(t: TabKey): void {
  window.history.replaceState(null, "", `#${t}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function useBriefNav(): BriefNav {
  const tab = useSyncExternalStore(subscribe, hashTab, serverTab);
  const [target, setTarget] = useState<{ n: number; seq: number } | null>(null);

  // Once the plan panel is visible, scroll to the asked item and flash it.
  useEffect(() => {
    if (tab !== "plan" || target === null) return;
    const el = document.getElementById(`plan-q-${String(target.n)}`);
    if (el === null) return;
    const smooth = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    el.focus({ preventScroll: true });
    el.classList.add("plan-flash");
    const timer = window.setTimeout(() => {
      el.classList.remove("plan-flash");
    }, FLASH_MS);
    return () => {
      window.clearTimeout(timer);
      el.classList.remove("plan-flash");
    };
  }, [tab, target]);

  const goToItem = useCallback((n: number) => {
    setHash("plan");
    setTarget((t) => ({ n, seq: (t?.seq ?? 0) + 1 }));
  }, []);

  return { tab, openTab: setHash, goToItem };
}

export type TabSpec = { key: TabKey; label: string; count: number; open?: boolean };

const TAB =
  "inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-semibold whitespace-nowrap text-muted hover:text-ink aria-selected:border-action aria-selected:text-ink";

export function TabBar({ tabs, label }: { tabs: readonly TabSpec[]; label: string }): React.JSX.Element {
  const { tab, openTab } = useNav();
  const refs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, i: number): void => {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    const t = tabs[next];
    if (t === undefined) return;
    openTab(t.key);
    refs.current[t.key]?.focus();
  };

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-divider bg-canvas px-4 print:hidden lg:mx-0 lg:px-0">
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[t.key] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-controls={`panel-${t.key}`}
            aria-selected={tab === t.key}
            tabIndex={tab === t.key ? 0 : -1}
            className={TAB}
            onClick={() => {
              openTab(t.key);
            }}
            onKeyDown={(e) => {
              onKey(e, i);
            }}
          >
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${t.open === true ? "bg-unsure-bg text-unsure" : "bg-sage/60 text-muted"}`}>{t.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TabPanel({ k, children }: { k: TabKey; children: React.ReactNode }): React.JSX.Element {
  const { tab } = useNav();
  const active = tab === k;
  return (
    <div role="tabpanel" id={`panel-${k}`} aria-labelledby={`tab-${k}`} tabIndex={0} className={`flex flex-col gap-6 pt-6 ${active ? "" : "tab-inactive hidden"}`}>
      {children}
    </div>
  );
}
