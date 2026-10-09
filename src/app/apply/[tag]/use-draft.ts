/**
 * The apply form's draft state: CV mode, file and pasted text, the marked fields and which one is announced.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/use-draft.ts
 * Deps:    react, src/app/_lib/form-text, ./apply-fields, ./apply-parts (fieldId, describedBy), ./apply-copy (Lang),
 *          ./cv-field (CvMode, CvEvents)
 * Tested:  the rules in src/app/apply/[tag]/__tests__/apply-fields.test.ts; the hook in the browser QA (specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - `draftOf(over)`: the draft from the form's own fields plus the CV state, with a just-changed CV value overriding
 *   the state React has not applied yet; the hidden mode's CV is blanked (the visible mode decides what is sent)
 * - `markAll`: every problem of a Send at once, the first focused and announced; `recheck`: marked fields clear as
 *   they are fixed, and a field that lost focus is marked when it is wrong
 * - `fieldProps` / `shell`: id, name, aria-invalid and aria-describedby for a control, error and alert for its Field
 * - `formEvents`: the form's blur and change listeners (name, email and LinkedIn re-checked on blur when filled or
 *   marked; marked fields re-checked as the form changes)
 * - `cvEvents`: the CV section's mode, file, text and refusal handlers (state set, then re-checked)
 * - `onEdit` runs on every change to the draft (a form field, the CV mode, file or text, a refused pick), so the form
 *   can drop the sentence of a failed send that no longer describes what is on screen
 *
 * Design constraints:
 * - Client only; the rules are checkApplyAll's, never re-implemented here
 */
import { useState, type FocusEvent, type RefObject, type SyntheticEvent } from "react";
import { formText } from "@/app/_lib/form-text";
import type { Lang } from "./apply-copy";
import { checkApplyAll, cvRefusal, type ApplyDraft, type ApplyField, type ApplyProblem } from "./apply-fields";
import { describedBy, fieldId } from "./apply-parts";
import type { CvEvents, CvMode } from "./cv-field";

type Errors = Partial<Record<ApplyField, string>>;
type CvOverride = { mode?: CvMode; file?: File | null; text?: string };
/** Fields checked again when they lose focus; the CV is checked as it changes. */
const ON_BLUR = new Set<string>(["name", "email", "linkedinUrl"]);
/** Controls the draft reads from the form itself; the CV's own handlers re-check with the new value. */
const FORM_FIELDS = new Set<string>([...ON_BLUR, "coverLetter"]);

type ControlProps = { id: string; name: ApplyField; "aria-invalid": boolean; "aria-describedby": string | undefined };

export type Draft = {
  cv: { mode: CvMode; file: File | null; text: string };
  cvEvents: CvEvents;
  alertOn: ApplyField | null;
  errorFor: (field: ApplyField) => string | null;
  draftOf: (over?: CvOverride) => ApplyDraft;
  markAll: (problems: ApplyProblem[]) => void;
  clear: () => void;
  fieldProps: (field: ApplyField) => ControlProps;
  shell: (field: ApplyField) => { field: ApplyField; error: string | null; alert: boolean };
  formEvents: { onBlur: (e: FocusEvent<HTMLFormElement>) => void; onChange: (e: SyntheticEvent<HTMLFormElement>) => void };
};

export function useDraft(formRef: RefObject<HTMLFormElement | null>, lang: Lang, onEdit: () => void): Draft {
  const [cvMode, setCvMode] = useState<CvMode>("file");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvText, setCvText] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [alertOn, setAlertOn] = useState<ApplyField | null>(null);

  function draftOf(over: CvOverride = {}): ApplyDraft {
    const data = formRef.current === null ? new FormData() : new FormData(formRef.current);
    const mode = over.mode ?? cvMode;
    const cv = mode === "file" ? (over.file === undefined ? cvFile : over.file) : null;
    const text = mode === "paste" ? (over.text ?? cvText) : "";
    return { name: formText(data, "name"), email: formText(data, "email"), linkedinUrl: formText(data, "linkedinUrl"), cv, cvText: text, message: formText(data, "coverLetter") };
  }

  /** Re-check the marked fields (plus `add`) against the draft: fixed ones clear, `add` is marked when it is wrong. */
  function recheck(over: CvOverride = {}, add: ApplyField | null = null): void {
    const now = new Map(checkApplyAll(draftOf(over), lang).map((p) => [p.field, p.message]));
    const next: Errors = {};
    for (const [field, message] of now) if (field in errors || field === add) next[field] = message;
    setErrors(next);
    if (add !== null && next[add] !== undefined) setAlertOn(add);
  }

  function markAll(problems: ApplyProblem[]): void {
    const first = problems[0];
    setErrors(Object.fromEntries(problems.map((p) => [p.field, p.message])));
    setAlertOn(first?.field ?? null);
    if (first !== undefined) document.getElementById(fieldId(first.field))?.focus();
  }

  function mark(field: ApplyField, message: string): void {
    setErrors({ ...errors, [field]: message });
    setAlertOn(field);
  }

  const errorFor = (field: ApplyField): string | null => errors[field] ?? null;
  const fieldProps = (field: ApplyField): ControlProps => {
    const error = errorFor(field);
    return { id: fieldId(field), name: field, "aria-invalid": error !== null, "aria-describedby": describedBy(field, false, error) };
  };
  const shell = (field: ApplyField): ReturnType<Draft["shell"]> => ({ field, error: errorFor(field), alert: alertOn === field });
  const formEvents: Draft["formEvents"] = {
    onBlur: (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && ON_BLUR.has(t.name) && (t.value.trim() !== "" || t.name in errors)) recheck({}, t.name as ApplyField);
    },
    onChange: (e) => {
      onEdit();
      const t = e.target as { name?: unknown };
      if (typeof t.name === "string" && FORM_FIELDS.has(t.name) && Object.keys(errors).length > 0) recheck();
    },
  };

  const cvEvents: CvEvents = {
    onMode: (mode) => {
      onEdit();
      setCvMode(mode);
      recheck({ mode });
    },
    onFile: (file) => {
      onEdit();
      setCvFile(file);
      recheck({ file });
    },
    onText: (text) => {
      onEdit();
      setCvText(text);
      if (Object.keys(errors).length > 0) recheck({ text });
    },
    onReject: (problem, picked, kept) => {
      onEdit();
      mark("cv", cvRefusal(problem, picked, kept, lang));
    },
  };

  return {
    cv: { mode: cvMode, file: cvFile, text: cvText },
    cvEvents,
    alertOn,
    errorFor,
    draftOf,
    markAll,
    clear: () => {
      setErrors({});
    },
    fieldProps,
    shell,
    formEvents,
  };
}
