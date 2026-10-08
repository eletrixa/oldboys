/**
 * New position form: posting text, posting URL and an optional title.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/new/new-position-form.tsx
 * Deps:    react, next/link, next/navigation, src/app/ui, src/app/_components (token, token-form)
 * Tested:  by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - POST /api/positions; on 201 or 200 route to /positions/<id> (the detail page flags fallback must-haves, so notes are not shown here)
 * - 4xx/5xx show the error next to the form and keep the input; 401 returns to the token form
 *
 * Design constraints:
 * - Client component; submit is disabled while pending and when text and URL are both empty
 * - The token is asked for up front and kept only in sessionStorage; it is read with useSyncExternalStore so the
 *   server render (token form) hydrates cleanly when the tab already holds one
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { authFetch, readToken, writeToken } from "@/app/_components/token";
import { TokenForm } from "@/app/_components/token-form";
import { BTN_PRIMARY, Eyebrow, FIELD } from "@/app/ui";

type CreateReply = { id?: string; error?: string };

const noop = (): void => undefined;
const subscribe = (): (() => void) => noop;
const noTokenOnServer = (): null => null;

export function NewPositionForm(): React.JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stored = useSyncExternalStore(subscribe, readToken, noTokenOnServer);
  const active = token ?? stored;
  const empty = text.trim() === "" && url.trim() === "";

  async function submit(): Promise<void> {
    if (empty) return;
    const fields = { postingText: text, postingUrl: url, title };
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) if (v.trim() !== "") body[k] = v.trim();
    setPending(true);
    setError(null);
    try {
      const res = await authFetch("/api/positions", active, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) {
        writeToken(null);
        setToken(null);
        setTokenError("That token did not work. Please try again.");
        return;
      }
      const reply = await res.json<CreateReply>().catch((): CreateReply => ({}));
      if (!res.ok || reply.id === undefined) {
        setError(reply.error ?? (res.status === 400 ? "Check the posting text, URL and title and try again." : "We could not add this position. Please try again."));
        return;
      }
      router.push(`/positions/${encodeURIComponent(reply.id)}`);
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <Link href="/positions" className="text-sm text-muted hover:text-ink">All positions</Link>
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Positions</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Add a position</h1>
        <p className="text-muted">Paste the job posting or give its link. We read the must-haves from it, and you can edit them.</p>
      </header>
      {active === null ? (
        <TokenForm
          error={tokenError}
          onSubmit={(t) => { writeToken(t); setToken(t); setTokenError(null); }}
          hint="Adding a position needs the team token. Kept only in this tab."
          submitLabel="Continue"
        />
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Posting text
            <textarea className={FIELD} rows={10} maxLength={20000} value={text} onChange={(e) => { setText(e.target.value); }} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Posting URL
            <input className={FIELD} type="url" inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); }} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Title (optional)
            <input className={FIELD} maxLength={300} value={title} onChange={(e) => { setTitle(e.target.value); }} />
          </label>
          {error !== null && <p role="alert" className="text-sm text-conflict">{error}</p>}
          <button type="submit" disabled={pending || empty} className={`${BTN_PRIMARY} self-start`}>
            {pending ? "Adding…" : "Add position"}
          </button>
        </form>
      )}
    </main>
  );
}
