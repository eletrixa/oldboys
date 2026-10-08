/**
 * Small form that creates an intake tag (POST /api/intake/tags) so positions need no SQL console.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/intake/tag-form.tsx
 * Deps:    react, src/app/_lib/operator-token
 * Tested:  n/a (the body rules are tested in src/app/api/intake/tags/__tests__/tag-body.test.ts)
 *
 * Key responsibilities:
 * - Fields: tag, role, goal (hiring or due-diligence), optional StartupJobs offer id
 * - POST with the stored operator token; on 201 reset the form, confirm in plain words and call onCreated
 * - Humane inline errors: duplicate (the server's 409 text), invalid, expired token, network
 *
 * Design constraints:
 * - Client component; the server re-validates everything, the input attributes only guide typing
 */
"use client";

import { useRef, useState } from "react";
import { authHeaders, readToken } from "@/app/_lib/operator-token";

const FIELD =
  "w-full rounded-xl border border-divider bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-action focus:outline-none";

type Notice = { kind: "error" | "ok"; text: string };

async function createTag(body: Record<string, string>): Promise<Notice> {
  try {
    const res = await fetch("/api/intake/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(readToken()) },
      body: JSON.stringify(body),
    });
    if (res.status === 201) return { kind: "ok", text: `Tag ${body.tag ?? ""} created.` };
    if (res.status === 401) return { kind: "error", text: "The access token no longer works. Reload the page to enter it again." };
    if (res.status === 409) {
      const { error } = await res.json<{ error: string }>();
      return { kind: "error", text: `${error}.` };
    }
    if (res.status === 400) return { kind: "error", text: "Check the fields: the tag uses lowercase letters, digits and hyphens (2 to 40 characters) and the role is required." };
    return { kind: "error", text: "We could not save the tag. Please try again." };
  } catch {
    return { kind: "error", text: "We could not reach the service. Please try again." };
  }
}

export function TagForm({ onCreated }: { onCreated: () => void }): React.JSX.Element {
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function submit(data: FormData): Promise<void> {
    const text = (key: string): string => {
      const raw = data.get(key);
      return typeof raw === "string" ? raw.trim() : "";
    };
    const offer = text("startupjobsOfferId");
    setBusy(true);
    setNotice(null);
    const result = await createTag({
      tag: text("tag"),
      role: text("role"),
      goal: text("goal"),
      ...(offer === "" ? {} : { startupjobsOfferId: offer }),
    });
    setBusy(false);
    setNotice(result);
    if (result.kind === "ok") {
      form.current?.reset();
      onCreated();
    }
  }

  return (
    <form
      ref={form}
      aria-label="Create a position tag"
      className="grid gap-3 rounded-xl border border-divider bg-surface p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(new FormData(e.currentTarget));
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tag
        <input name="tag" required minLength={2} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9\-]+" placeholder="senior-be" autoComplete="off" className={FIELD} />
        <span className="text-xs font-normal text-muted">Lowercase letters, digits and hyphens.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Role
        <input name="role" required maxLength={300} placeholder="Senior Backend Engineer" autoComplete="off" className={FIELD} />
        <span className="text-xs font-normal text-muted">What the brief checks the candidate against.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Goal
        <select name="goal" defaultValue="hiring" className={FIELD}>
          <option value="hiring">hiring</option>
          <option value="due-diligence">due-diligence</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        StartupJobs offer id (optional)
        <input name="startupjobsOfferId" maxLength={40} autoComplete="off" className={FIELD} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-xl bg-action px-4 py-2 font-medium text-white hover:bg-action-hover disabled:opacity-60">
          {busy ? "Saving…" : "Create tag"}
        </button>
        {notice !== null && (
          <p role={notice.kind === "error" ? "alert" : "status"} className={`text-sm ${notice.kind === "error" ? "text-conflict" : "text-ok"}`}>
            {notice.text}
          </p>
        )}
      </div>
    </form>
  );
}
