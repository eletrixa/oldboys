/**
 * Hook: GET one bearer-protected JSON route with the stored operator token.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/use-authed-json.ts
 * Deps:    react, src/app/_components/token
 * Tested:  n/a (covered by e2e/positions.spec.ts)
 *
 * Key responsibilities:
 * - States loading / token / notfound / error / ready; 401 clears the token and asks again
 * - Makes no request while there is no token
 *
 * Design constraints:
 * - Client only; a stale response never overwrites a newer one
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch, readToken, writeToken } from "@/app/_components/token";

export type AuthedLoad<T> =
  | { kind: "loading" }
  | { kind: "token"; error: string | null }
  | { kind: "notfound" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: T };

async function load<T>(path: string, token: string | null): Promise<AuthedLoad<T>> {
  if (token === null) return { kind: "token", error: null };
  try {
    const res = await authFetch(path, token);
    if (res.status === 401 || res.status === 503) {
      writeToken(null);
      return { kind: "token", error: res.status === 401 ? "That token did not work. Please try again." : "The service has no access token set." };
    }
    if (res.status === 404) return { kind: "notfound" };
    if (!res.ok) return { kind: "error", message: "We could not load this page. Please try again." };
    writeToken(token);
    return { kind: "ready", data: await res.json<T>() };
  } catch {
    return { kind: "error", message: "We could not reach the service. Please try again." };
  }
}

export function useAuthedJson<T>(path: string): {
  state: AuthedLoad<T>;
  submitToken: (token: string) => void;
  setData: (data: T) => void;
} {
  const [state, setState] = useState<AuthedLoad<T>>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    void load<T>(path, readToken()).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [path]);

  const submitToken = useCallback(
    (token: string) => {
      setState({ kind: "loading" });
      void load<T>(path, token).then(setState);
    },
    [path],
  );
  const setData = useCallback((data: T) => {
    setState({ kind: "ready", data });
  }, []);
  return { state, submitToken, setData };
}
