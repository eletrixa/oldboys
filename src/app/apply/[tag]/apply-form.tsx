/**
 * Apply form: name, email, LinkedIn or CV PDF and an optional message, posted as multipart to /api/apply.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/apply-form.tsx
 * Deps:    react, src/app/_lib/form-text, src/domain/application (CV_MAX_BYTES), ./apply-fields
 * Tested:  src/app/apply/[tag]/__tests__/apply-fields.test.ts (validation); submit path via src/app/api/apply/__tests__/apply.test.ts
 *
 * Key responsibilities:
 * - Client check with checkApply (LinkedIn or CV required), then fetch with FormData (the browser sets the boundary)
 * - Honeypot field `website`, visually hidden, out of tab order and out of the accessibility tree
 * - Thank-you state on 200/201, the hourly-cap sentence on 429, a humane inline error otherwise
 *
 * Design constraints:
 * - Client component; no token, no run id and no application id ever reaches or leaves it
 * - Copy stays short and calm; no emoji; never mentions research
 */
"use client";

import { useState } from "react";
import { formText } from "@/app/_lib/form-text";
import { CV_MAX_BYTES } from "@/domain/application";
import { checkApply, MESSAGE_MAX } from "./apply-fields";

const FIELD =
  "w-full min-h-11 rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted focus:border-focus focus:outline-none";

const CV_MB = String(CV_MAX_BYTES / (1024 * 1024));

type Phase = "editing" | "sending" | "done";

function Label({ text, optional = false, children }: Readonly<{ text: string; optional?: boolean; children: React.ReactNode }>): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>
        {text}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </span>
      {children}
    </label>
  );
}

/** The handler's 400 texts are written for candidates, so show them as they are. */
async function badRequestMessage(res: Response): Promise<string> {
  try {
    const body = await res.json<{ error?: unknown }>();
    if (typeof body.error === "string") return body.error;
  } catch {
    // not JSON: fall through to the generic sentence
  }
  return "Please check your details and try again.";
}

export function ApplyForm({ tag }: Readonly<{ tag: string }>): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>("editing");
  const [error, setError] = useState<string | null>(null);

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const picked = data.get("cv");
    const cv = picked instanceof File && picked.size > 0 ? picked : null;
    const problem = checkApply({ name: formText(data, "name"), email: formText(data, "email"), linkedinUrl: formText(data, "linkedinUrl"), cv, message: formText(data, "coverLetter") });
    if (problem !== null) {
      setError(problem);
      return;
    }
    data.set("tag", tag);
    if (cv === null) data.delete("cv");
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/apply", { method: "POST", body: data });
      if (res.status === 200 || res.status === 201) {
        setPhase("done");
        return;
      }
      if (res.status === 429) setError("Too many applications right now, try again in an hour.");
      else if (res.status === 400) setError(await badRequestMessage(res));
      else setError("We could not send your application. Please try again in a few minutes.");
    } catch {
      setError("We could not reach the service. Please check your connection and try again.");
    }
    setPhase("editing");
  }

  if (phase === "done") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <h2 className="text-2xl">Received. We&apos;ll be in touch.</h2>
        <p className="text-muted">Thank you for applying. We will reply by email.</p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      aria-label="Apply"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <Label text="Full name">
        <input name="name" type="text" autoComplete="name" required maxLength={200} className={FIELD} />
      </Label>
      <Label text="Email">
        <input name="email" type="email" autoComplete="email" required maxLength={200} className={FIELD} />
      </Label>
      <Label text="LinkedIn profile" optional>
        {/* type="text" with a url keyboard: the browser would reject "linkedin.com/in/..." without https, the server accepts it */}
        <input name="linkedinUrl" type="text" inputMode="url" maxLength={500} placeholder="https://www.linkedin.com/in/..." className={FIELD} />
        <span className="text-xs font-normal text-muted">Add your LinkedIn profile or attach a CV below. One of the two is enough.</span>
      </Label>
      <Label text={`CV (PDF, up to ${CV_MB} MB)`} optional>
        <input
          name="cv"
          type="file"
          accept="application/pdf,.pdf"
          className={`${FIELD} file:mr-4 file:rounded-lg file:border-0 file:bg-sage file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink`}
        />
      </Label>
      <Label text="Message" optional>
        <textarea name="coverLetter" rows={5} maxLength={MESSAGE_MAX} className={FIELD} />
      </Label>
      <div aria-hidden="true" className="sr-only">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-conflict">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={phase === "sending"}
          className="min-h-11 rounded-xl bg-action px-5 py-3 font-semibold text-white hover:bg-action-hover disabled:opacity-60"
        >
          {phase === "sending" ? "Sending..." : "Send application"}
        </button>
      </div>
    </form>
  );
}
