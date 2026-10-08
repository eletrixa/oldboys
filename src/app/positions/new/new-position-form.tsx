/**
 * New position form: posting text, posting URL and an optional title.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/new/new-position-form.tsx
 * Deps:    react, next/navigation, src/domain/position-links, src/app/_components/token
 * Tested:  body builder in src/domain/__tests__/position-links.test.ts; view by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - POST /api/positions; on 201 or 200 route to /positions/<id> (the detail page flags fallback must-haves, so notes are not shown here)
 * - 4xx/5xx show the error next to the form and keep the input; 401 returns to the token form
 *
 * Design constraints:
 * - Client component; submit is disabled while pending and when text and URL are both empty
 * - The token is asked for up front and kept only in sessionStorage
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authFetch, readToken, writeToken } from "@/app/_components/token";
import { TokenForm } from "@/app/_components/token-form";
import { buildCreateBody } from "@/domain/position-links";

const FIELD = "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-normal text-zinc-100 focus:border-teal-400 focus:outline-none";

type CreateReply = { id?: string; error?: string };

export function NewPositionForm(): React.JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = token ?? readToken();
  const body = buildCreateBody({ postingText: text, postingUrl: url, title });

  async function submit(): Promise<void> {
    if (body === null) return;
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <Link href="/positions" className="text-sm text-zinc-400 hover:text-zinc-200">All positions</Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Add a position</h1>
        <p className="text-zinc-400">Paste the job posting or give its link. We read the must-haves from it, and you can edit them.</p>
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
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Posting text
            <textarea className={FIELD} rows={10} maxLength={20000} value={text} onChange={(e) => { setText(e.target.value); }} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Posting URL
            <input className={FIELD} type="url" inputMode="url" value={url} onChange={(e) => { setUrl(e.target.value); }} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Title (optional)
            <input className={FIELD} maxLength={300} value={title} onChange={(e) => { setTitle(e.target.value); }} />
          </label>
          {error !== null && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button type="submit" disabled={pending || body === null} className="self-start rounded-xl bg-teal-500 px-4 py-2 font-medium text-zinc-950 hover:bg-teal-400 disabled:opacity-50">
            {pending ? "Adding…" : "Add position"}
          </button>
        </form>
      )}
    </main>
  );
}
