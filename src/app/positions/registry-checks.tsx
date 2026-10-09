/**
 * "Registry checks" section of a position: which Czech public registries every candidate of this position is checked against.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/registry-checks.tsx
 * Deps:    src/domain/cz-registry (registriesFor), src/app/ui (CARD, Eyebrow, LINK, Pill)
 * Tested:  src/app/positions/__tests__/registry-checks.test.ts
 *
 * Key responsibilities:
 * - `registryPlan(title)`: the everyone registries, the ones the title adds, and the ones that must be checked by hand
 * - RegistryChecks: three short lists with the registry's search page linked; pure from the title, nothing stored
 *
 * Design constraints:
 * - Client component without state; the catalog is the single source of truth (src/domain/cz-registry)
 */
"use client";

import { type Registry, registriesFor } from "@/domain/cz-registry";
import { CARD, Eyebrow, LINK, Pill } from "@/app/ui";

export function registryPlan(title: string): { everyone: Registry[]; role: Registry[]; manual: Registry[] } {
  const all = registriesFor(title);
  return {
    everyone: all.filter((r) => r.scope === "everyone"),
    role: all.filter((r) => r.scope === "role" && r.access === "fetch"),
    manual: all.filter((r) => r.access === "manual"),
  };
}

function List({ items }: { items: Registry[] }): React.JSX.Element {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map((r) => (
        <li key={r.id}>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className={LINK}>
            {r.name}
          </a>{" "}
          <span className="text-xs text-muted">({r.name_cs})</span>
        </li>
      ))}
    </ul>
  );
}

export function RegistryChecks({ title }: { title: string }): React.JSX.Element {
  const plan = registryPlan(title);
  return (
    <section id="registry-checks" className={`${CARD} scroll-mt-6`} aria-labelledby="position-registries">
      <Eyebrow>Every candidate of this position</Eyebrow>
      <h2 id="position-registries" className="mt-1 font-serif text-xl">
        Registry checks
      </h2>
      <p className="mt-1 text-xs text-muted">Name searches in Czech public registries, run with every brief; hits are listed with the registry&apos;s wording and a link, never as a verdict.</p>
      <p className="mt-3 text-xs text-muted">For every position</p>
      <List items={plan.everyone} />
      {plan.role.length > 0 && (
        <>
          <p className="mt-3 text-xs text-muted">
            Added for this role <Pill tone="neutral">{title}</Pill>
          </p>
          <List items={plan.role} />
        </>
      )}
      {plan.manual.length > 0 && (
        <>
          <p className="mt-3 text-xs text-muted">Needed for this role, by hand only (CAPTCHA or signed access)</p>
          <List items={plan.manual} />
        </>
      )}
    </section>
  );
}
