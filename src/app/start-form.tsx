/**
 * Candidate Brief start form: the candidate's LinkedIn profile URL or pasted CV, plus the role, then POSTs /api/start.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/start-form.tsx
 * Deps:    react, next/navigation, ./ui (Radar tokens), ./start-body, ./start-position, ./profile-picker, ./role-picker, src/app/_lib/form-text
 * Tested:  n/a (body builder: src/app/__tests__/start-body.test.ts)
 *
 * Key responsibilities:
 * - Submit {goal: "hiring", role, profileUrl?, cvText?} (plans/006); on 201 route to /runs/<id>
 * - The profile comes from ProfilePicker (plans/011): a pasted URL or a picked public-profile suggestion, via the hidden profileUrl input
 * - With `?positionId=<id>` (specs/positions-pages): show the position's title and must-haves read-only, hide the role
 *   field and send positionId instead of role; an unknown id shows an inline note and the normal form
 * - Client check: one of profile URL or CV; the server normalises and validates the URL
 * - initialRole / autoFocusRole prefill and focus the role field; 401 shows a log-in link
 * - Role field is the RolePicker over `roleOptions` (catalog titles, families, aliases from the server page); free text still allowed
 * - Inline humane error on 4xx/5xx or network failure
 *
 * Design constraints:
 * - Client component; reads the query with useSearchParams inside Suspense so the home page stays static; posts to /api/start
 *   with the session cookie; no token ships to the browser
 * - Helper text sits beside the label (aria-describedby), never inside it; CV summary is a 44px target
 * - Copy stays short and calm; no emoji
 */
"use client";

import Link from "next/link";
import { trackRun } from "@/app/_components/run-tray-store";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { formText } from "@/app/_lib/form-text";
import { buildStartBody, positionIdParam } from "./start-body";
import { ProfilePicker } from "./profile-picker";
import { PositionBanner, usePositionSummary } from "./start-position";
import { RolePicker } from "./role-picker";
import type { RoleOption } from "@/domain/role-catalog";
import { BTN_PRIMARY, CARD_PEACH, CARD_SAGE, Chevron, FIELD, LINK, SUMMARY } from "./ui";

const CV_MAX = 20_000;

type FieldProps = {
  name: string;
  label: string;
  helper?: string;
  required?: boolean;
  defaultValue?: string;
  autoFocus?: boolean;
};

function Field({ name, label, helper, required = false, defaultValue, autoFocus = false }: FieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold">{label}</label>
      <input
        id={name}
        name={name}
        type="text"
        required={required}
        maxLength={300}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        aria-describedby={helper === undefined ? undefined : `${name}-help`}
        className={FIELD}
      />
      {helper !== undefined && <span id={`${name}-help`} className="text-xs text-muted">{helper}</span>}
    </div>
  );
}

type StartFormProps = { initialRole?: string; autoFocusRole?: boolean; roleOptions?: readonly RoleOption[] };

function StartFormInner({ initialRole, autoFocusRole = false, roleOptions = [] }: StartFormProps): React.JSX.Element {
  const router = useRouter();
  const position = usePositionSummary(positionIdParam(useSearchParams()));
  const positionId = position.status === "ready" ? position.summary.id : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function submit(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const profileUrl = formText(data, "profileUrl").trim();
    const cvText = formText(data, "cvText").trim();
    if (position.status === "loading") return;
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
        body: JSON.stringify(buildStartBody({ role: formText(data, "role").trim(), profileUrl, cvText, positionId })),
      });
      if (res.status === 201) {
        const { id } = await res.json<{ id: string }>();
        trackRun(id);
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
      <ProfilePicker invalid={error?.includes("LinkedIn") === true} />
      <details className="group border-t border-divider pt-2">
        <summary className={SUMMARY}><Chevron />Or paste their CV instead</summary>
        <textarea
          name="cvText"
          rows={8}
          maxLength={CV_MAX}
          placeholder="Paste the CV text here"
          className={`${FIELD} mt-3`}
        />
      </details>
      {positionId === null && position.status !== "loading" && (
        <RolePicker options={roleOptions} defaultValue={initialRole} autoFocus={autoFocusRole} />
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

export function StartForm(props: StartFormProps): React.JSX.Element {
  return (
    <Suspense>
      <StartFormInner {...props} />
    </Suspense>
  );
}
