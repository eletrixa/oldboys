/**
 * Small presentational pieces of the apply form: labelled field shell, inline error, honeypot, send footer, progress and the done card.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/apply-parts.tsx
 * Deps:    react, src/app/ui (FIELD, BTN_PRIMARY, LINK), ./apply-fields (ApplyField, HONEYPOT), ./apply-copy
 * Tested:  n/a (visual; copy helpers in apply-fields.test.ts, the page is driven in the browser QA of specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - `Field`: label (+ "optional"), control, hint and the error under it, wired with ids and aria-describedby
 * - `FieldError`: an error sentence under its field; only the one passed `alert` is the `role=alert` region
 * - `Honeypot`: the `hp_contact` trap, visually hidden, out of tab order and the accessibility tree, with a label no
 *   autofill heuristic maps to a person's data
 * - `SendFooter`: the form-level failure, one send button ("Try again" after a retryable failure; aria-disabled, not
 *   disabled, while sending so focus stays on it), `SendProgress` and the privacy line
 * - `SendProgress`: progressbar with "Uploading N%", then "Checking your CV" until the answer arrives
 * - `DoneCard`: "Received. We'll reply to <email>." plus what was attached and when to expect a reply; its heading
 *   takes focus once, when it appears
 *
 * Design constraints:
 * - Radar tokens only; no emoji; candidate-facing copy never mentions research
 * - Client module (DoneCard focuses in an effect); used only by the client form
 */
"use client";

import { useEffect, useRef, type RefObject } from "react";
import { BTN_PRIMARY, FIELD, LINK } from "@/app/ui";
import type { ApplyCopy } from "./apply-copy";
import { HONEYPOT, type ApplyField } from "./apply-fields";

export const fieldId = (field: ApplyField): string => `apply-${field}`;

/** FIELD plus the conflict border while the control is invalid. */
export const CONTROL = `${FIELD} min-h-11 aria-invalid:border-conflict`;

/** aria-describedby for a control with an optional hint line and an optional error. */
export function describedBy(field: ApplyField, hint: boolean, error: string | null): string | undefined {
  const ids = [hint ? `${field}-hint` : null, error !== null ? `${field}-error` : null].filter((id) => id !== null);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

type ErrorProps = { field: ApplyField | "form"; message: string | null; alert: boolean };

export function FieldError({ field, message, alert }: Readonly<ErrorProps>): React.JSX.Element | null {
  if (message === null) return null;
  return (
    <p role={alert ? "alert" : undefined} id={`${field}-error`} className="text-sm text-conflict">
      {message}
    </p>
  );
}

type FieldShell = { field: ApplyField; label: string; optional?: string; hint?: string; error: string | null; alert: boolean; children: React.ReactNode };

export function Field({ field, label, optional, hint, error, alert, children }: Readonly<FieldShell>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId(field)} className="text-sm font-semibold">
        {label}
        {optional !== undefined && <span className="font-normal text-muted"> {optional}</span>}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${field}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError field={field} message={error} alert={alert} />
    </div>
  );
}

/** Bots fill every input; people never see this one. Its name and label say nothing autofill could match. */
export function Honeypot({ inputRef }: Readonly<{ inputRef: RefObject<HTMLInputElement | null> }>): React.JSX.Element {
  return (
    <div aria-hidden="true" className="sr-only">
      <label>
        Leave this empty
        <input ref={inputRef} name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

type Progress = ApplyCopy["progress"];

export function SendProgress({ percent, checking, copy }: Readonly<{ percent: number; checking: string; copy: Progress }>): React.JSX.Element {
  const done = percent >= 100;
  const label = done ? checking : copy.uploading(percent);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={copy.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-divider"
      >
        <div
          className={`h-full rounded-full bg-action transition-[width] duration-200 motion-reduce:transition-none ${done ? "animate-pulse motion-reduce:animate-none" : ""}`}
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      <p className="text-sm text-muted tabular-nums" aria-hidden="true">
        {label}
      </p>
      <p role="status" className="sr-only">
        {done ? checking : copy.label}
      </p>
    </div>
  );
}

type Footer = {
  copy: ApplyCopy;
  sendRef: RefObject<HTMLButtonElement | null>;
  failure: { message: string; retry: boolean } | null;
  /** Upload percent while sending, else null. */
  percent: number | null;
  checking: string;
  privacy: { line: string; href: string };
};

export function SendFooter({ copy, sendRef, failure, percent, checking, privacy }: Readonly<Footer>): React.JSX.Element {
  const sending = percent !== null;
  const label = sending ? copy.form.sending : failure?.retry === true ? copy.form.tryAgain : copy.form.send;
  return (
    <div className="flex flex-col gap-3">
      {failure !== null && (
        <div className="rounded-lg border border-conflict/40 bg-conflict-bg p-4">
          <FieldError field="form" message={failure.message} alert />
        </div>
      )}
      {/* aria-disabled, not disabled: the focused button keeps focus while sending; the form's ref guard ignores a 2nd tap */}
      <button ref={sendRef} type="submit" aria-disabled={sending} className={`${BTN_PRIMARY} self-start aria-disabled:cursor-wait aria-disabled:opacity-60`}>
        {label}
      </button>
      {sending && <SendProgress percent={percent} checking={checking} copy={copy.progress} />}
      <p className="text-xs leading-relaxed text-muted">
        {privacy.line}{" "}
        <a href={privacy.href} target="_blank" rel="noopener" className={LINK}>
          {copy.privacy.link}
          <span className="sr-only"> {copy.privacy.newTab}</span>
        </a>
      </p>
    </div>
  );
}

type Done = { email: string; attached: string; copy: ApplyCopy["done"] };

export function DoneCard({ email, attached, copy }: Readonly<Done>): React.JSX.Element {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div role="status" className="flex flex-col gap-3">
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-2xl [overflow-wrap:anywhere]"
      >
        {copy.heading(email)}
      </h2>
      <p className="[overflow-wrap:anywhere] text-ink">{attached}</p>
      <p className="text-ink">{copy.horizon}</p>
      <p className="text-muted">{copy.close}</p>
    </div>
  );
}
