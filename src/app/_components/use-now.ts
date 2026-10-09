/**
 * Hook: a wall clock that ticks once a second while something is live, so elapsed and remaining times move between polls.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/_components/use-now.ts
 * Deps:    react
 * Tested:  n/a (one effect; the time arithmetic it feeds is tested in src/domain/__tests__/run-eta.test.ts)
 *
 * Key responsibilities:
 * - `useNow(live)`: Date.now() refreshed every second while `live`, frozen at the last value otherwise
 *
 * Design constraints:
 * - Client only; one interval per caller, cleared on unmount or when `live` turns false
 */
"use client";

import { useEffect, useState } from "react";

const TICK_MS = 1000;

export function useNow(live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [live]);
  return now;
}
