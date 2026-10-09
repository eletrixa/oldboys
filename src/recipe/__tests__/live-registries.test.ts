/**
 * Opt-in live smoke of the Czech registry collector against the real registries (no Apify, no money).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/__tests__/live-registries.test.ts
 * Deps:    vitest, src/adapters/fetch (network)
 * Tested:  n/a (LIVE=1 SUBJECT="Jan Novák" ROLE="Advokát" pnpm exec vitest run live-registries)
 *
 * Key responsibilities:
 * - Skipped unless LIVE=1; runs the cz_registries step with the real fetch adapter and prints one line per registry
 * - Asserts that every registry the role needs answered (status clear or hits, never unavailable)
 *
 * Design constraints:
 * - Never part of `pnpm check`; nothing is written to D1 or R2
 */
import { describe, expect, it } from "vitest";
import { fetchJson } from "@/adapters/fetch";
import { hiringRecipe } from "@/recipe/goals/hiring";
import { collectWith } from "@/recipe/runner";
import { czRegistries } from "@/recipe/sources/cz-registries";
import type { RegistryChecks } from "@/domain/cz-registry";
import { baseContext, fakePorts } from "./fakes";

const live = process.env.LIVE === "1";

describe.skipIf(!live)("live Czech registries (LIVE=1)", () => {
  it("every registry the role needs answers", async () => {
    const step = hiringRecipe.steps.find((s) => s.id === "cz_registries");
    if (step === undefined) throw new Error("no cz_registries step");
    const ctx = baseContext({ subject: process.env.SUBJECT ?? "Jan Novák", anchor: "Praha", role: process.env.ROLE ?? "Advokát" });
    const ports = fakePorts({ fetchJson, newId: () => crypto.randomUUID(), now: () => new Date().toISOString() });
    const out = await collectWith(czRegistries, step, ctx, ports);
    const digest = out.digest as RegistryChecks;
    for (const c of digest.checks) {
      process.stdout.write(`${c.registry.padEnd(12)} ${c.status.padEnd(12)} hits=${String(c.hits.length)} total=${String(c.total)} ${c.note ?? ""}\n`);
      for (const h of c.hits.slice(0, 3)) process.stdout.write(`    ${h.label} [${h.status ?? "-"}] ${h.url}\n`);
    }
    for (const n of out.notes) process.stdout.write(`note: ${n}\n`);
    expect(digest.checks.filter((c) => c.status === "unavailable")).toEqual([]);
  }, 120_000);
});
