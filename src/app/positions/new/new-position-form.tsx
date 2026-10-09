/**
 * New position form: a posting link we read automatically, or a position entered by hand.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/positions/new/new-position-form.tsx
 * Deps:    react, next/link, next/navigation, src/app/ui, src/app/_components (token, auth-states)
 * Tested:  by e2e/positions.spec.ts
 *
 * Key responsibilities:
 * - Two modes: "From a link" (StartupJobs, Jobs.cz incl. company career sites, Greenhouse, Lever, Ashby, any page with JobPosting data)
 *   and "By hand" (title required, company, location and posting text optional)
 * - POST /api/positions; on 201 or 200 route to /positions/<id> (the detail page flags generic must-haves, so notes are not shown here),
 *   or back to `next` with `positionId=<id>` when the page was opened from the New brief wizard
 * - 4xx/5xx show the error next to the form and keep the input; 401 swaps the form for the log-in card (token form behind "Use the team token instead"), input kept
 *
 * Design constraints:
 * - Client component; submit is disabled while pending and when the active mode has nothing to send
 * - The session cookie travels by default; a token, if the tab holds one, is sent as bearer. It lives only in
 *   sessionStorage and is read with useSyncExternalStore so the server render hydrates cleanly
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { authFetch, readToken, writeToken } from "@/app/_components/token";
import { LoginOrToken } from "@/app/_components/auth-states";
import { BTN_PRIMARY, Eyebrow, FIELD } from "@/app/ui";

type CreateReply = { id?: string; error?: string };
type Mode = "link" | "manual";

const noop = (): void => undefined;
const subscribe = (): (() => void) => noop;
const noTokenOnServer = (): null => null;
const BOARDS = "StartupJobs, Jobs.cz (company career sites too), Greenhouse, Lever, Ashby and any page with job posting data";
const TAB = "rounded-full px-4 py-2 text-sm font-medium transition-colors";
const TAB_ON = `${TAB} bg-ink text-white`;
const TAB_OFF = `${TAB} text-muted hover:bg-sage/60 hover:text-ink`;

export function NewPositionForm({ next = null }: { next?: string | null }): React.JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("link");
  const [token, setToken] = useState<string | null>(null);
  const [denied, setDenied] = useState<{ tokenFailed: boolean } | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stored = useSyncExternalStore(subscribe, readToken, noTokenOnServer);
  const active = token ?? stored;
  const empty = mode === "link" ? url.trim() === "" : title.trim() === "";

  function switchMode(next: Mode): void {
    setMode(next);
    setError(null);
  }

  async function submit(): Promise<void> {
    if (empty) return;
    const fields: Record<string, string> = mode === "link" ? { postingUrl: url } : { title, company, location, postingText: text };
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) if (v.trim() !== "") body[k] = v.trim();
    setPending(true);
    setError(null);
    try {
      const res = await authFetch("/api/positions", active, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) {
        writeToken(null);
        setToken(null);
        setDenied({ tokenFailed: active !== null });
        return;
      }
      const reply = await res.json<CreateReply>().catch((): CreateReply => ({}));
      if (!res.ok || reply.id === undefined) {
        const fallback = res.status === 400 ? "Check the fields and try again." : "We could not add this position. Please try again.";
        setError(reply.error !== undefined ? humanize(reply.error) : fallback);
        return;
      }
      const id = encodeURIComponent(reply.id);
      router.push(next === null ? `/positions/${id}` : `${next}${next.includes("?") ? "&" : "?"}positionId=${id}`);
    } catch {
      setError("We could not reach the service. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:py-14">
      <Link href={next ?? "/positions"} className="text-sm text-muted hover:text-ink">{next === null ? "All positions" : "Back to the new brief"}</Link>
      <header className="flex flex-col items-start gap-3 border-b border-divider pb-8">
        <Eyebrow>Positions</Eyebrow>
        <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Add a position</h1>
        <p className="text-muted">Paste a link to the job posting and we read the title, company, location and must-haves for you. Or enter the position by hand.</p>
      </header>
      {denied !== null ? (
        <LoginOrToken
          title="Log in to add a position"
          body="Positions are shared by your team. Log in to add one."
          error={denied.tokenFailed ? "That token did not work. Please try again." : null}
          onToken={(t) => { writeToken(t); setToken(t); setDenied(null); }}
          hint="Adding a position needs the team token. Kept only in this tab."
          submitLabel="Continue"
        />
      ) : (
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div role="tablist" aria-label="How to add the position" className="flex gap-1 self-start rounded-full border border-line bg-surface p-1">
            <button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? TAB_ON : TAB_OFF} onClick={() => { switchMode("link"); }}>
              From a link
            </button>
            <button type="button" role="tab" aria-selected={mode === "manual"} className={mode === "manual" ? TAB_ON : TAB_OFF} onClick={() => { switchMode("manual"); }}>
              By hand
            </button>
          </div>
          {mode === "link" ? (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Posting URL
              <input
                className={FIELD}
                type="url"
                inputMode="url"
                autoFocus
                placeholder="https://www.jobs.cz/rpd/…"
                value={url}
                onChange={(e) => { setUrl(e.target.value); }}
              />
              <span className="text-xs font-normal text-muted">Works with {BOARDS}. Reading a posting takes about ten seconds.</span>
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Title
                <input className={FIELD} maxLength={300} autoFocus placeholder="Senior Data Engineer" value={title} onChange={(e) => { setTitle(e.target.value); }} />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Company (optional)
                  <input className={FIELD} maxLength={200} value={company} onChange={(e) => { setCompany(e.target.value); }} />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  Location (optional)
                  <input className={FIELD} maxLength={200} placeholder="Praha, hybrid" value={location} onChange={(e) => { setLocation(e.target.value); }} />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Posting text (optional)
                <textarea className={FIELD} rows={8} maxLength={20000} placeholder="Paste the job description to get must-haves read from it. Without it you get three generic must-haves to edit." value={text} onChange={(e) => { setText(e.target.value); }} />
              </label>
            </>
          )}
          {error !== null && <p role="alert" className="text-sm text-conflict">{error}</p>}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending || empty} className={BTN_PRIMARY}>
              {pending ? (mode === "link" ? "Reading the posting…" : "Adding…") : "Add position"}
            </button>
            {pending && mode === "link" && <span role="status" className="text-sm text-muted">Fetching the page and extracting must-haves.</span>}
          </div>
        </form>
      )}
    </main>
  );
}

/** Server reasons end with "paste the posting text instead"; here that means switching to the By hand tab. */
function humanize(reason: string): string {
  return reason.replace(/;\s*paste the posting text instead$/, ". Switch to “By hand” and paste the posting text instead.");
}
