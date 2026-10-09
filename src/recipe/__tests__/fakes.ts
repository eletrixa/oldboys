/**
 * Fake ports and fixtures shared by recipe tests.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/fakes.ts
 * Deps:    none
 * Tested:  n/a (test helper)
 *
 * Key responsibilities:
 * - `fakePorts()` returns in-memory ports that record every call; tests inspect `calls` (actor, fetch, llm, treg) and override behaviour; `callTreg: null` simulates an unset TREG_TOKEN
 *
 * Design constraints:
 * - No network, no timers; ids and timestamps are deterministic
 */
import type { Ports } from "@/domain/ports";
import type { StepContext } from "@/recipe/sources/types";

export function baseContext(over: Partial<StepContext> = {}): StepContext {
  return {
    runId: "run-1",
    subject: "Jana Dvořáková",
    anchor: "Brno",
    goal: "hiring",
    role: "Senior Data Engineer",
    roleFamily: "data",
    roleSites: [],
    questions: [
      { id: "current-role", text: "Current role and employer?" },
      { id: "public-code", text: "Public code?" },
    ],
    candidates: [],
    sources: [],
    claims: [],
    gaps: [],
    budget: { usd: 0.5, calls: 12 },
    spent: { usd: 0, calls: 0 },
    ...over,
  };
}

export type FakePorts = Ports & { calls: { actor: string[]; fetch: string[]; llm: string[]; treg: string[] }; stored: unknown[] };

export function fakePorts(over: Partial<Ports> = {}): FakePorts {
  let n = 0;
  const calls = { actor: [] as string[], fetch: [] as string[], llm: [] as string[], treg: [] as string[] };
  const stored: unknown[] = [];
  const callActor: Ports["callActor"] = over.callActor ?? (() => Promise.resolve({ items: [], cost_usd: 0.001 }));
  const fetchJson: Ports["fetchJson"] = over.fetchJson ?? (() => Promise.resolve({}));
  const callTreg: Ports["callTreg"] = "callTreg" in over ? over.callTreg ?? null : () => Promise.resolve({ payload: null, cost_usd: 0.001 });
  const llm: Ports["llm"] = over.llm ?? (() => Promise.reject(new Error("no fake llm configured")));
  return {
    calls,
    stored,
    callActor: (input) => {
      calls.actor.push(input.actor);
      return callActor(input);
    },
    fetchJson: (url, init) => {
      calls.fetch.push(url);
      return fetchJson(url, init);
    },
    callTreg:
      callTreg === null
        ? null
        : (req) => {
            calls.treg.push(req.endpoint);
            return callTreg(req);
          },
    llm: (input) => {
      calls.llm.push(input.model);
      return llm(input);
    },
    appendLedger: over.appendLedger ?? ((e) => Promise.resolve({ ...e, seq: ++n, ts: "2026-10-08T00:00:00.000Z" })),
    storeSource:
      over.storeSource ??
      ((s, raw) => {
        stored.push(raw);
        return Promise.resolve({ ...s, r2_key: `${s.run_id}/${s.id}.json` });
      }),
    now: over.now ?? (() => "2026-10-08T00:00:00.000Z"),
    newId: over.newId ?? (() => `id-${String(++n)}`),
  };
}

/** Build a fake LlmCall that returns `pick(prompt)` as the value, bypassing the schema generic. */
export function fakeLlm(pick: (prompt: string) => unknown): Ports["llm"] {
  return ((input: { prompt: string }) => Promise.resolve({ value: pick(input.prompt), cost_usd: 0.001 })) as Ports["llm"];
}

export const serpFixture = [
  {
    organicResults: [
      { title: "Jana Dvořáková - Data Engineer - Kiwi.com | LinkedIn", url: "https://cz.linkedin.com/in/jana-dvorakova-data", description: "Data Engineer at Kiwi.com · Brno, South Moravia" },
      { title: "jdvorakova (Jana Dvořáková) · GitHub", url: "https://github.com/jdvorakova", description: "Data pipelines, dbt, Airflow. Brno." },
      { title: "Jana Dvořáková - dětská sestra - FN Ostrava | LinkedIn", url: "https://cz.linkedin.com/in/jana-dvorakova-nurse", description: "Pediatric nurse, Ostrava" },
    ],
  },
];
