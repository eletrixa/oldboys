/**
 * Candidate Brief start form: the candidate's LinkedIn profile URL or pasted CV, plus the role, then POSTs /api/start.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/start-form.tsx
 * Deps:    react, next/navigation, ./ui (Radar tokens), ./start-body, ./start-position
 * Tested:  n/a (body builder: src/app/__tests__/start-body.test.ts)
 *
 * Key responsibilities:
 * - Submit {goal: "hiring", role, profileUrl?, cvText?} (plans/006); on 201 route to /runs/<id>
 * - With `?positionId=<id>` (specs/positions-pages): show the position's title and must-haves read-only, hide the role
 *   field and send positionId instead of role; an unknown id shows an inline note and the normal form
 * - Client check: one of profile URL or CV; the server normalises and validates the URL
 * - Inline humane error on 4xx/5xx or network failure
 *
 * Design constraints:
 * - Client component; reads the query with useSearchParams inside Suspense so the home page stays static; posts to /api/start, which adds RUN_TOKEN server-side, so no token ships to the browser
 * - Copy stays short and calm; no emoji
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { buildStartBody, positionIdParam } from "./start-body";
import { PositionBanner, usePositionSummary } from "./start-position";
import { BTN_PRIMARY, CARD_PEACH, CARD_SAGE, FIELD } from "./ui";

const CV_MAX = 20_000;

type FieldProps = {
  name: string;
  label: string;
  helper?: string;
  type?: "text" | "url";
  placeholder?: string;
  required?: boolean;
};

function Field({ name, label, helper, type = "text", placeholder, required = false }: FieldProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      {/* type="text" with a url keyboard: the browser would reject "linkedin.com/in/..." without https, the server accepts it */}
      <input name={name} type="text" inputMode={type === "url" ? "url" : "text"} required={required} maxLength={type === "url" ? 500 : 300} placeholder={placeholder} className={FIELD} />
      {helper !== undefined && <span className="text-xs font-normal text-muted">{helper}</span>}
    </label>
  );
}

function StartFormInner(): React.JSX.Element {
  const router = useRouter();
  const position = usePositionSummary(positionIdParam(useSearchParams()));
  const positionId = position.status === "ready" ? position.summary.id : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const text = (key: string): string => {
      const raw = data.get(key);
      return typeof raw === "string" ? raw.trim() : "";
    };
    const profileUrl = text("profileUrl");
    const cvText = text("cvText");
    if (position.status === "loading") return;
    if (profileUrl === "" && cvText === "") {
      setError("Please add their LinkedIn profile or paste their CV.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildStartBody({ role: text("role"), profileUrl, cvText, positionId })),
      });
      if (res.status === 201) {
        const { id } = await res.json<{ id: string }>();
        router.push(`/runs/${id}`);
        return;
      }
      setError(
        res.status === 429
          ? "Too many briefs started just now. Please try again in a little while."
          : res.status === 503
            ? "The service is not fully configured yet. Please tell the team."
            : res.status === 404
              ? "That position is no longer available. Please pick it again from Positions."
              : res.status === 400
              ? "Please check the LinkedIn link (it looks like linkedin.com/in/...) and the role, and try again."
              : "We could not start the brief. Please try again.",
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
      {position.status === "ready" && <PositionBanner summary={position.summary} />}
      {position.status === "error" && (
        <p role="status" className={`${CARD_PEACH} text-sm`}>
          We could not load that position, so you can name the role yourself.
        </p>
      )}
      <Field
        name="profileUrl"
        type="url"
        label="Candidate's LinkedIn profile"
        placeholder="https://www.linkedin.com/in/..."
        helper="We read their name, location and employer from it, so we know exactly who they are."
      />
      <details className="group rounded-lg border border-divider p-4">
        <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-ink">or paste their CV</summary>
        <textarea
          name="cvText"
          rows={8}
          maxLength={CV_MAX}
          placeholder="Paste the CV text here"
          className={`${FIELD} mt-3`}
        />
      </details>
      {positionId === null && position.status !== "loading" && (
        <Field name="role" label="Role you are hiring for" required helper="The brief focuses on what matters for this role." />
      )}
      <p className={`${CARD_SAGE} text-sm text-ink`}>
        <strong>Privacy:</strong> Public information only. We never look at private accounts, and we do not judge
        personality, health, religion or politics. Everything we collect is deleted after 7 days.
      </p>
      {error !== null && (
        <p role="alert" className="text-sm text-conflict">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy || position.status === "loading"}
          className={BTN_PRIMARY}
        >
          {busy ? "Creating..." : "Create brief"}
        </button>
        <span className="text-sm text-muted">Usually takes 2 to 4 minutes</span>
      </div>
    </form>
  );
}

export function StartForm(): React.JSX.Element {
  return (
    <Suspense>
      <StartFormInner />
    </Suspense>
  );
}
