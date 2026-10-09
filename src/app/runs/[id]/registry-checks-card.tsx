/**
 * "Czech public registries" card on the run page: one row per registry checked, the registry's own lines for hits, links to repeat each search.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/registry-checks-card.tsx
 * Deps:    src/domain/cz-registry (catalog, caveats, types), ../../ui (CARD, Eyebrow, LINK, Pill)
 * Tested:  n/a (the digest it renders is tested in src/recipe/__tests__/cz-registries.test.ts)
 *
 * Key responsibilities:
 * - RegistryChecksCard: rows "clear" / "N records (namesake possible)" / "not available", each with the search link; hits listed
 *   under the row with their status word and link; registries the role needs but no Worker may query are listed as "check by hand"
 *   with the search page; the fixed caveats close the card; nothing when `checks` is null
 *
 * Design constraints:
 * - No hooks, English only; the registry's wording and a link, never a judgment about the person
 */
import { type Registry, REGISTRIES, REGISTRY_CAVEATS, type RegistryCheck, type RegistryChecks, registriesFor, registryById } from "@/domain/cz-registry";
import { CARD, Eyebrow, LINK, Pill } from "../../ui";

function Ext({ url, children }: { url: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
    </a>
  );
}

function Row({ check }: { check: RegistryCheck }): React.JSX.Element {
  const r = registryById(check.registry);
  const shown = check.hits.length;
  const more = check.total !== null && check.total > shown ? ` of ${String(check.total)}` : "";
  return (
    <li className="border-t border-divider py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{r.name}</span>
        <span className="text-xs text-muted">{r.name_cs}</span>
        {check.status === "clear" && <Pill tone="neutral">no record under this name</Pill>}
        {check.status === "hits" && (
          <Pill tone="unsure">
            {String(shown)}
            {more} record{shown === 1 && more === "" ? "" : "s"} · namesake possible
          </Pill>
        )}
        {check.status === "unavailable" && <Pill tone="conflict">not available</Pill>}
        <Ext url={check.source_url}>repeat the search</Ext>
      </div>
      <p className="mt-1 text-xs text-muted">
        Searched: {check.searched}. {r.means.charAt(0).toUpperCase() + r.means.slice(1)}.
        {check.note !== null && ` ${check.note}`}
      </p>
      {check.hits.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {check.hits.map((h) => (
            <li key={`${h.url}:${h.label}`} className="flex flex-wrap items-baseline gap-2">
              <span>{h.label}</span>
              {h.status !== null && <Pill tone="neutral">{h.status}</Pill>}
              <Ext url={h.url}>source</Ext>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Registries the role needs that only a person can query (CAPTCHA, signed access). */
export function manualRegistries(role: string | null): Registry[] {
  return registriesFor(role).filter((r) => r.access === "manual");
}

export function RegistryChecksCard({ checks }: { checks: RegistryChecks | null | undefined }): React.JSX.Element | null {
  if (checks === null || checks === undefined) return null;
  const manual = manualRegistries(checks.role);
  return (
    <section className={CARD} aria-labelledby="registry-checks">
      <Eyebrow>Czech public registries · name search</Eyebrow>
      <h2 id="registry-checks" className="mt-1 font-serif text-2xl">
        Public registries
      </h2>
      <p className="mt-1 text-sm text-muted">
        {String(checks.checks.length)} of {String(REGISTRIES.length)} registries searched for {checks.subject}
        {checks.role !== null && ` (role: ${checks.role})`}.
      </p>
      <ul className="mt-3">
        {checks.checks.map((c) => (
          <Row key={c.registry} check={c} />
        ))}
      </ul>
      {manual.length > 0 && (
        <div className="mt-3 border-t border-divider pt-3 text-sm">
          <p className="text-xs text-muted">The role also needs these registries, which allow no automated query (CAPTCHA or signed access). Check by hand:</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {manual.map((r) => (
              <li key={r.id}>
                <Ext url={r.url}>{r.name}</Ext> <span className="text-xs text-muted">({r.name_cs})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="mt-4 space-y-1 text-xs text-muted">
        {REGISTRY_CAVEATS.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </section>
  );
}
