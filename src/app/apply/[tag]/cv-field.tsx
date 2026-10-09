/**
 * The apply form's CV section: the file drop zone (cv-drop.tsx) or, after one quiet toggle, a textarea for pasted text.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/cv-field.tsx
 * Deps:    src/app/ui (BTN_QUIET), src/domain/application (CV_MAX), ./apply-parts, ./apply-copy, ./apply-fields, ./cv-drop,
 *          ./stray-drop
 * Tested:  helpers in src/app/apply/[tag]/__tests__/apply-fields.test.ts; the widget in the browser QA (specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - "No file at hand? Paste your CV text" swaps the zone for a textarea with a live character count, and back
 * - Routes the current CV problem to the zone ("cv") or the textarea ("cvText")
 * - Swallows a file dropped anywhere on the page (stray-drop.ts) in both modes, so a drop never loses the draft
 *
 * Design constraints:
 * - Controlled: the form owns the file, the text, the mode and the error; this component only reports picks
 * - No maxLength on the textarea: a paste over the limit is shown and refused, never silently cut
 */
"use client";

import { BTN_QUIET } from "@/app/ui";
import { CV_MAX } from "@/domain/application";
import type { ApplyCopy } from "./apply-copy";
import type { FileProblem } from "./apply-fields";
import { CONTROL, describedBy, FieldError, fieldId } from "./apply-parts";
import { CvDrop } from "./cv-drop";
import { useNoStrayDrop } from "./stray-drop";

export type CvMode = "file" | "paste";

/** What the section reports: a mode switch, a picked or removed file, typed text, and a refused pick. */
export type CvEvents = {
  onMode: (mode: CvMode) => void;
  onFile: (file: File | null) => void;
  onText: (text: string) => void;
  onReject: (problem: FileProblem, picked: string, kept: string | null) => void;
};

type Props = CvEvents & {
  mode: CvMode;
  file: File | null;
  text: string;
  /** The sentence under the zone and under the textarea, or null; `alert` names the one that is announced. */
  errors: { cv: string | null; cvText: string | null };
  alert: "cv" | "cvText" | null;
  /** The server refused the attached file (its sentence is `errors.cv`): the zone turns red although a file is there. */
  refused: boolean;
  copy: { legend: string; cv: ApplyCopy["cv"] };
};

export function CvField({ mode, onMode, file, onFile, text, onText, errors, alert, refused, onReject, copy }: Readonly<Props>): React.JSX.Element {
  const textError = errors.cvText;
  useNoStrayDrop();

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{copy.legend}</legend>
      {mode === "file" ? (
        <CvDrop file={file} onFile={onFile} error={errors.cv} alert={alert === "cv"} refused={refused} onReject={onReject} copy={copy.cv} />
      ) : (
        <>
          <label htmlFor={fieldId("cvText")} className="sr-only">
            {copy.cv.pasteLabel}
          </label>
          <textarea
            id={fieldId("cvText")}
            name="cvText"
            rows={8}
            autoFocus
            value={text}
            onChange={(e) => {
              onText(e.currentTarget.value);
            }}
            aria-invalid={textError !== null}
            aria-describedby={describedBy("cvText", true, textError)}
            placeholder={copy.cv.pastePlaceholder}
            className={CONTROL}
          />
          <p id="cvText-hint" className={`text-xs tabular-nums ${text.length > CV_MAX ? "text-conflict" : "text-muted"}`}>
            {copy.cv.count(text.length)}
          </p>
          <FieldError field="cvText" message={textError} alert={alert === "cvText"} />
        </>
      )}
      <button
        type="button"
        onClick={() => {
          onMode(mode === "file" ? "paste" : "file");
        }}
        className={`${BTN_QUIET} -ml-3 self-start text-left whitespace-normal underline decoration-line/60 underline-offset-4`}
      >
        {mode === "file" ? copy.cv.pasteToggle : copy.cv.fileToggle}
      </button>
    </fieldset>
  );
}
