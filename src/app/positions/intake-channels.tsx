/**
 * Intake channels of a position: how candidates reach its bound tag, or a form to bind one.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/intake-channels.tsx
 * Deps:    react, src/app/ui, src/app/_components/token, ./pool-rows
 * Tested:  channelsFor in src/app/positions/__tests__/pool-rows.test.ts; view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - For each bound tag list email, apply page, Google Form hidden field and StartupJobs offer
 * - Bind form: POST /api/intake/tags {tag, positionId, startupjobsOfferId?}; the route is bearer-only, so a 401 asks for the team token
 *
 * Design constraints:
 * - Client component; the token stays in sessionStorage (writeToken) and is sent only as the Authorization header
 * - A bound tag pools candidates, it never starts a run
 */
"use client";

import { useState } from "react";
import { postJson, writeToken } from "@/app/_components/token";
import type { TagRow } from "@/app/intake/intake-rows";
import { BTN_SECONDARY, CARD, FIELD, FRAG, KEY } from "@/app/ui";
import { channelsFor, defaultTag } from "./pool-rows";

type Props = { positionId: string; title: string; tags: TagRow[]; onReload: () => Promise<void> };

function BindTag({ positionId, title, onReload }: Omit<Props, "tags">): React.JSX.Element {
  const [tag, setTag] = useState(defaultTag(title));
  const [offer, setOffer] = useState("");
  const [token, setToken] = useState("");
  const [needToken, setNeedToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (token.trim() !== "") writeToken(token.trim());
    try {
      const res = await postJson("/api/intake/tags", { tag: tag.trim(), positionId, ...(offer.trim() !== "" && { startupjobsOfferId: offer.trim() }) });
      if (res.status === 401) {
        setNeedToken(true);
        setError(token.trim() === "" ? "This needs the team token." : "That token did not work. Please try again.");
        return;
      }
      if (!res.ok) {
        const body = await res.json<{ error?: string }>().catch(() => ({ error: undefined }));
        setError(body.error ?? "We could not bind this tag. Check the fields and try again.");
        return;
      }
      await onReload();
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={`${CARD} flex flex-col gap-3`} aria-label="Bind an intake tag">
      <h3 className="font-medium">Bind an intake tag</h3>
      <p className="text-sm text-muted">Applications that arrive under this tag land in the pool above. No research starts until you start it.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Tag
          <input className={`${FIELD} px-3 py-2`} value={tag} maxLength={40} onChange={(e) => { setTag(e.target.value); }} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          StartupJobs offer id (optional)
          <input className={`${FIELD} px-3 py-2`} value={offer} maxLength={40} onChange={(e) => { setOffer(e.target.value); }} />
        </label>
      </div>
      {needToken && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Team token
          <input type="password" autoComplete="off" className={`${FIELD} px-3 py-2`} value={token} onChange={(e) => { setToken(e.target.value); }} />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={BTN_SECONDARY} disabled={tag.trim().length < 2 || busy}>Bind tag</button>
        <span role="status" className="text-sm text-conflict">{error}</span>
      </div>
    </form>
  );
}

export function IntakeChannels({ positionId, title, tags, onReload }: Props): React.JSX.Element {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <section id="intake-channels" aria-labelledby="channels-heading" className="flex scroll-mt-6 flex-col gap-4">
      <h2 id="channels-heading" className="font-serif text-2xl">Intake channels</h2>
      {tags.length === 0 ? (
        <BindTag positionId={positionId} title={title} onReload={onReload} />
      ) : (
        tags.map((t) => (
          <div key={t.tag} className={FRAG}>
            <span className={KEY}>Channels for {t.tag}</span>
            <dl className="grid gap-x-6 gap-y-2 md:grid-cols-[auto_1fr]" aria-label={`Channels for ${t.tag}`}>
              {channelsFor(t, origin).map((c) => (
                <div key={c.label} className="contents">
                  <dt className="text-muted">{c.label}</dt>
                  <dd className="break-all font-mono">{c.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))
      )}
    </section>
  );
}
