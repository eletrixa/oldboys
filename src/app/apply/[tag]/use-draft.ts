/**
 * The apply form's draft state: CV mode, file and pasted text, the marked fields and which one is announced.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/use-draft.ts
 * Deps:    react, src/app/_lib/form-text, ./apply-fields, ./apply-parts (fieldId, describedBy), ./apply-copy (Lang)
 * Tested:  the rules in src/app/apply/[tag]/__tests__/apply-fields.test.ts; the hook in the browser QA (specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - `draftOf(over)`: the draft from the form's own fields plus the CV state, with a just-changed CV value overriding
 *   the state React has not applied yet; the hidden mode's CV is blanked (the visible mode decides what is sent)
 * - `markAll`: every problem of a Send at once, the first focused and announced; `recheck`: marked fields clear as
 *   they are fixed, and a field that lost focus is marked when it is wrong
 * - `fieldProps` / `shell`: id, name, aria-invalid and aria-describedby for a control, error and alert for its Field
 *
 * Design constraints:
 * - Client only; the rules are checkApplyAll's, never re-implemented here
 */
import { useState, type RefObject } from "react";
import { formText } from "@/app/_lib/form-text";
import type { Lang } from "./apply-copy";
import { checkApplyAll, type ApplyDraft, type ApplyField, type ApplyProblem } from "./apply-fields";
import { describedBy, fieldId } from "./apply-parts";
import type { CvMode } from "./cv-field";

type Errors = Partial<Record<ApplyField, string>>;
type CvOverride = { mode?: CvMode; file?: File | null; text?: string };
type ControlProps = { id: string; name: ApplyField; "aria-invalid": boolean; "aria-describedby": string | undefined };

export type Draft = {
  cv: { mode: CvMode; file: File | null; text: string; setMode: (m: CvMode) => void; setFile: (f: File | null) => void; setText: (t: string) => void };
  hasErrors: boolean;
  isMarked: (field: string) => boolean;
  alertOn: ApplyField | null;
  errorFor: (field: ApplyField) => string | null;
  draftOf: (over?: CvOverride) => ApplyDraft;
  recheck: (over?: CvOverride, add?: ApplyField | null) => void;
  markAll: (problems: ApplyProblem[]) => void;
  mark: (field: ApplyField, message: string) => void;
  clear: () => void;
  fieldProps: (field: ApplyField, hint?: boolean) => ControlProps;
  shell: (field: ApplyField) => { field: ApplyField; error: string | null; alert: boolean };
};

export function useDraft(formRef: RefObject<HTMLFormElement | null>, lang: Lang): Draft {
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
  const fieldProps = (field: ApplyField, hint = false): ControlProps => {
    const error = errorFor(field);
    return { id: fieldId(field), name: field, "aria-invalid": error !== null, "aria-describedby": describedBy(field, hint, error) };
  };
  const shell = (field: ApplyField): ReturnType<Draft["shell"]> => ({ field, error: errorFor(field), alert: alertOn === field });

  return {
    cv: { mode: cvMode, file: cvFile, text: cvText, setMode: setCvMode, setFile: setCvFile, setText: setCvText },
    hasErrors: Object.keys(errors).length > 0,
    isMarked: (field: string) => field in errors,
    alertOn,
    errorFor,
    draftOf,
    recheck,
    markAll,
    mark,
    clear: () => {
      setErrors({});
    },
    fieldProps,
    shell,
  };
}
