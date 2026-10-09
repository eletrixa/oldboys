/**
 * New brief step 1: pick one of the organization's positions, or create one from the role catalog without leaving the page.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/briefs/new/position-step.tsx
 * Deps:    react, next/link, src/app/{ui,role-picker}, src/app/_components/token (postJson), src/domain/{position,role-catalog} (types)
 * Tested:  by e2e/brief-flow.spec.ts
 *
 * Key responsibilities:
 * - Searchable list of positions (title, company, location); a click picks it
 * - "Create from role catalog": RolePicker plus POST /api/positions {title}; a catalog title brings its template must-haves
 * - "From a posting" links to /positions/new?next=/briefs/new, which returns here with the new position picked
 * - Once picked: title and must-haves read-only, and "Change"
 *
 * Design constraints:
 * - Client component; the server page passes the list, the wizard owns the chosen position
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/app/_components/token";
import { RolePicker } from "@/app/role-picker";
import { BTN_PRIMARY, BTN_QUIET, CARD_SAGE, FIELD, LINK, Pill } from "@/app/ui";
import type { MustHave, PositionListItem } from "@/domain/position";
import type { RoleOption } from "@/domain/role-catalog";
import { failText } from "./brief-rows";

export type Chosen = { id: string; title: string; mustHaves: readonly MustHave[] | null };

type Props = {
  positions: readonly PositionListItem[];
  roleOptions: readonly RoleOption[];
  chosen: Chosen | null;
  onPick: (id: string, title: string) => void;
  onChange: () => void;
};

export function PositionStep({ positions, roleOptions, chosen, onPick, onChange }: Props): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const shown = positions.filter((p) => q === "" || [p.title, p.company ?? "", p.location ?? ""].some((s) => s.toLowerCase().includes(q)));

  async function create(e: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const role = new FormData(e.currentTarget).get("role");
    const title = typeof role === "string" ? role.trim() : "";
    if (title === "") return;
    setBusy(true);
    setError(null);
    try {
      const res = await postJson("/api/positions", { title });
      const out = await res.json<{ id?: string }>().catch((): { id?: string } => ({}));
      if (!res.ok || out.id === undefined) {
        setError(failText(res.status, "We could not create this position. Please try again."));
        return;
      }
      onPick(out.id, title);
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (chosen !== null) {
    return (
      <div className={`${CARD_SAGE} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-serif text-2xl">{chosen.title}</h3>
          <button type="button" className={BTN_QUIET} onClick={onChange}>Change</button>
        </div>
        {chosen.mustHaves === null ? (
          <p role="status" className="text-sm text-muted">Loading must-haves…</p>
        ) : (
          <ul aria-label="Must-haves" className="flex flex-col gap-1.5 text-sm">
            {chosen.mustHaves.map((m) => (
              <li key={m.id}>
                {m.title !== undefined && <span className="font-semibold">{m.title}: </span>}
                {m.text}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/positions/${encodeURIComponent(chosen.id)}`} className={`${LINK} self-start text-sm`}>Edit must-haves on the position</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Find a position
        <input className={FIELD} type="search" placeholder="Title, company or city" value={query} onChange={(e) => { setQuery(e.target.value); }} />
      </label>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{positions.length === 0 ? "No positions yet. Create one below." : "No position matches."}</p>
      ) : (
        <ul aria-label="Positions" className="flex max-h-72 flex-col divide-y divide-divider overflow-auto rounded-lg border border-line bg-surface">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex min-h-11 w-full items-baseline justify-between gap-3 px-4 py-2 text-left hover:bg-sage/40" onClick={() => { onPick(p.id, p.title); }}>
                <span>
                  <span className="font-semibold">{p.title}</span>
                  {(p.company ?? p.location) !== null && <span className="block text-xs text-muted">{[p.company, p.location].filter((s) => s !== null).join(" · ")}</span>}
                </span>
                <Pill tone="neutral">{p.family}</Pill>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-col gap-3 border-t border-divider pt-5" aria-label="Create from role catalog" onSubmit={(e) => void create(e)}>
        <h3 className="font-semibold">Or create one from the role catalog</h3>
        <RolePicker options={roleOptions} />
        {error !== null && <p role="alert" className="text-sm text-conflict">{error}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy ? "Creating…" : "Create position"}</button>
          <Link href="/positions/new?next=/briefs/new" className={LINK}>From a posting</Link>
        </div>
      </form>
    </div>
  );
}
