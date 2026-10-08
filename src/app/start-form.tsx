/**
 * Candidate Brief start form: the candidate's LinkedIn profile URL or pasted CV, plus the role, then POSTs /api/start.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/start-form.tsx
 * Deps:    react, next/navigation, ./ui (Radar tokens)
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Submit {goal: "hiring", role, profileUrl?, cvText?} (plans/006); on 201 route to /runs/<id>
 * - Client check: one of profile URL or CV; the server normalises and validates the URL
 * - initialRole / autoFocusRole prefill and focus the role field; 401 shows a log-in link
 * - Inline humane error on 4xx/5xx or network failure
 *
 * Design constraints:
 * - Client component; posts to /api/start with the session cookie; no token ships to the browser
 * - Helper text sits beside the label (aria-describedby), never inside it; CV summary is a 44px target
 * - Copy stays short and calm; no emoji
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BTN_PRIMARY, CARD_SAGE, FIELD, LINK } from "./ui";

const CV_MAX = 20_000;

type FieldProps = {
  name: string;
  label: string;
  helper?: string;
  type?: "text" | "url";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  autoFocus?: boolean;
  invalid?: boolean;
};

function Field({ name, label, helper, type = "text", placeholder, required = false, defaultValue, autoFocus = false, invalid = false }: FieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold">{label}</label>
      {/* type="text" with a url keyboard: the browser would reject "linkedin.com/in/..." without https, the server accepts it */}
      <input
        id={name}
        name={name}
        type="text"
        inputMode={type === "url" ? "url" : "text"}
        required={required}
        maxLength={type === "url" ? 500 : 300}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        aria-describedby={helper === undefined ? undefined : `${name}-help`}
        aria-invalid={invalid || undefined}
        className={FIELD}
      />
      {helper !== undefined && <span id={`${name}-help`} className="text-xs text-muted">{helper}</span>}
    </div>
  );
}

type StartFormProps = { initialRole?: string; autoFocusRole?: boolean };

export function StartForm({ initialRole, autoFocusRole = false }: StartFormProps): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const text = (key: string): string => {
      const raw = data.get(key);
      return typeof raw === "string" ? raw.trim() : "";
    };
    const profileUrl = text("profileUrl");
    const cvText = text("cvText");
    if (profileUrl === "" && cvText === "") {
      setError("Please add their LinkedIn profile or paste their CV.");
      return;
    }
    setBusy(true);
    setError(null);
    setExpired(false);
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "hiring",
          role: text("role"),
          ...(profileUrl === "" ? {} : { profileUrl }),
          ...(cvText === "" ? {} : { cvText }),
        }),
      });
      if (res.status === 201) {
        const { id } = await res.json<{ id: string }>();
        router.push(`/runs/${id}`);
        return;
      }
      if (res.status === 401) {
        setExpired(true);
        setBusy(false);
        return;
      }
      setError(
        res.status === 429
          ? "Too many briefs started just now. Please try again in a little while."
          : res.status === 503
            ? "The service is not fully configured yet. Please tell the team."
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
      <Field
        name="profileUrl"
        type="url"
        invalid={error?.includes("LinkedIn") === true}
        label="Candidate's LinkedIn profile"
        placeholder="https://www.linkedin.com/in/..."
        helper="We read their name, location and employer from it, so we know exactly who they are."
      />
      <details className="group rounded-lg border border-line/60 p-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-muted hover:text-ink">or paste their CV</summary>
        <textarea
          name="cvText"
          rows={8}
          maxLength={CV_MAX}
          placeholder="Paste the CV text here"
          className={`${FIELD} mt-3`}
        />
      </details>
      <Field name="role" label="Role you are hiring for" required defaultValue={initialRole} autoFocus={autoFocusRole} helper="The brief focuses on what matters for this role." />
      <p className={`${CARD_SAGE} text-sm text-ink`}>
        <strong>Privacy:</strong> Public information only. We never look at private accounts, and we do not judge
        personality, health, religion or politics. Everything we collect is deleted after 7 days.
      </p>
      {error !== null && (
        <p role="alert" className="text-sm text-conflict">
          {error}
        </p>
      )}
      {expired && (
        <p role="alert" className="text-sm text-conflict">
          Your session has ended. Please{" "}
          <Link href="/login" className={LINK}>
            log in
          </Link>{" "}
          again.
        </p>
      )}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
        <button
          type="submit"
          disabled={busy}
          className={BTN_PRIMARY}
        >
          {busy ? "Creating..." : "Create brief"}
        </button>
        <span className="text-sm text-muted">Usually takes 2 to 4 minutes</span>
      </div>
    </form>
  );
}
