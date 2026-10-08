/**
 * Candidate Brief start form: collects name, anchor and role, then POSTs /api/runs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/start-form.tsx
 * Deps:    react, next/navigation
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Submit {subject, anchor, goal: "hiring", role}; on 201 route to /runs/<id>
 * - Inline humane error on 4xx/5xx or network failure
 *
 * Design constraints:
 * - Client component; token comes from NEXT_PUBLIC_RUN_TOKEN and is omitted when unset
 * - Copy stays short and calm; no emoji
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const FIELD =
  "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-teal-400 focus:outline-none";

type FieldProps = {
  name: string;
  label: string;
  helper?: string;
};

function Field({ name, label, helper }: FieldProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input name={name} required maxLength={200} className={FIELD} />
      {helper !== undefined && <span className="text-xs font-normal text-zinc-400">{helper}</span>}
    </label>
  );
}

export function StartForm(): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const text = (key: string): string => {
      const raw = data.get(key);
      return typeof raw === "string" ? raw.trim() : "";
    };
    const token = process.env.NEXT_PUBLIC_RUN_TOKEN;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token !== undefined && token !== "" ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ subject: text("name"), anchor: text("anchor"), goal: "hiring", role: text("role") }),
      });
      if (res.status === 201) {
        const { id } = await res.json<{ id: string }>();
        router.push(`/runs/${id}`);
        return;
      }
      setError(
        res.status === 429
          ? "Too many briefs started just now. Please try again in a little while."
          : "We could not start the brief. Please check the details and try again.",
      );
    } catch {
      setError("We could not reach the service. Please try again.");
    }
    setBusy(false);
  }

  return (
    <form
      className="flex flex-col gap-5"
      aria-label="Create a candidate brief"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Candidate's full name" />
        <Field
          name="anchor"
          label="City, or a link to their profile"
          helper="Helps us find the right person when names repeat."
        />
      </div>
      <Field name="role" label="Role you are hiring for" helper="The brief focuses on what matters for this role." />
      <p className="rounded-xl border border-emerald-900 bg-emerald-950/50 p-4 text-sm text-emerald-100">
        <strong>Privacy:</strong> Public information only. We never look at private accounts, and we do not judge
        personality, health, religion or politics. Collected data is deleted after judging.
      </p>
      {error !== null && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-teal-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-teal-400 disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create brief"}
        </button>
        <span className="text-sm text-zinc-400">Usually takes 2 to 4 minutes</span>
      </div>
    </form>
  );
}
