/**
 * "Profile signals" card on the run page: one sentence per fact about a confirmed public account, each with its source link.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-signals-card.tsx
 * Deps:    src/domain/profile-signals (types, caveats), ./profile-signals-text (safeHref), ../../ui (CARD, Eyebrow)
 * Tested:  src/app/runs/[id]/__tests__/profile-signals-card.test.ts
 *
 * Key responsibilities:
 * - ProfileSignalsCard: signals as sentences with a small "source" link and a muted "Ask: …" line, the "Not checked" list and the caveats;
 *   nothing when `signals` is null or absent; with zero signals the honesty line "No account signals on this run." plus not-checked and caveats
 *
 * Design constraints:
 * - No hooks, English only; no colour per signal, no counts, no badges, no icons, never a score
 */
import { PROFILE_SIGNAL_CAVEATS, type ProfileSignals } from "@/domain/profile-signals";
import { CARD, Eyebrow } from "../../ui";
import { safeHref } from "./profile-signals-text";

export function ProfileSignalsCard({ signals }: { signals: ProfileSignals | null | undefined }): React.JSX.Element | null {
  if (signals === null || signals === undefined) return null;
  return (
    <section className={CARD} aria-labelledby="profile-signals">
      <Eyebrow>What the public accounts show</Eyebrow>
      <h2 id="profile-signals" className="mt-1 font-serif text-2xl">
        Profile signals
      </h2>

      {signals.signals.length === 0 ? (
        <p className="mt-3 text-sm text-ink">No account signals on this run.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          {signals.signals.map((s) => {
            const href = safeHref(s.source_url);
            return (
              <li key={`${s.id}:${s.profile_url}`} className="break-words">
                <span className="text-ink">{s.text}</span>
                {href !== null && (
                  <a href={href} target="_blank" rel="noreferrer" className="ml-1 text-xs text-muted underline underline-offset-2 hover:text-ink">
                    source
                  </a>
                )}
                {s.ask !== null && <p className="mt-0.5 text-muted">Ask: {s.ask}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {signals.not_checked.length > 0 && (
        <div className="mt-4 text-sm">
          <h3 className="text-xs font-semibold text-muted">Not checked</h3>
          <ul className="mt-1 list-disc pl-5 text-ink">
            {signals.not_checked.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-4 list-disc pl-5 text-xs text-muted">
        {PROFILE_SIGNAL_CAVEATS.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </section>
  );
}
