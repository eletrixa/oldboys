/**
 * The CV drop zone: one button that opens the file picker and takes a dropped file, plus the chosen file row.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/cv-drop.tsx
 * Deps:    react, ./apply-fields, ./apply-parts, ./apply-copy, ./cv-file-row
 * Tested:  helpers (cvFileProblem, cvRefusal, pickDropped) in src/app/apply/[tag]/__tests__/apply-fields.test.ts; the widget in the browser QA (specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - Pick by click, keyboard or drag-and-drop (zone highlighted while a file is over it); a second file replaces the first;
 *   of several dropped at once the first usable one is taken and a line under the zone says so
 * - Type and size checked the moment a file is chosen (`cvFileProblem`); a refused file never replaces a good one, and
 *   the refusal names both files (`cvRefusal`) while the zone keeps its neutral border
 * - Shows the chosen file (cv-file-row.tsx); its Remove hands focus back to the zone
 *
 * Design constraints:
 * - The hidden input has no name, so FormData never carries a stale file; the form adds the chosen one itself
 * - A file dropped beside the zone is swallowed by stray-drop.ts, mounted by cv-field.tsx so paste mode is covered too
 * - Children of the zone ignore pointer events, so dragleave fires only when the file leaves the zone
 */
"use client";

import { useRef, useState } from "react";
import type { ApplyCopy } from "./apply-copy";
import { CV_ACCEPT, cvFileProblem, pickDropped, type FileProblem } from "./apply-fields";
import { describedBy, FieldError, fieldId } from "./apply-parts";
import { FileRow } from "./cv-file-row";

type Copy = ApplyCopy["cv"];

type Props = {
  file: File | null;
  onFile: (file: File | null) => void;
  /** The current problem when it belongs to the file, else null; `alert` when it is the one announced. */
  error: string | null;
  alert: boolean;
  /** A picked file was refused: why, the picked name, and the name of the file that stays attached (or null). */
  onReject: (problem: FileProblem, picked: string, kept: string | null) => void;
  copy: Copy;
};

const ZONE = "flex min-h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none";

export function CvDrop({ file, onFile, error, alert, onReject, copy }: Readonly<Props>): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);
  /** "Only one file can be attached, so we took x.pdf." after a drop of several; cleared by the next pick. */
  const [took, setTook] = useState<string | null>(null);

  function pick(picked: File | undefined, of = 1): void {
    if (picked === undefined) return;
    setTook(of > 1 && cvFileProblem(picked) === null ? copy.multiDrop(picked.name) : null);
    const problem = cvFileProblem(picked);
    if (problem !== null) onReject(problem, picked.name, file?.name ?? null);
    else onFile(picked);
  }

  // Red only when the problem is the zone's own (no file yet); a refused second file leaves the good one, and a calm zone.
  const tone = over
    ? "border-action bg-peach/40"
    : error !== null && file === null
      ? "border-conflict bg-surface"
      : "border-line bg-canvas hover:border-ink hover:bg-sage/40";

  return (
    <>
      <button
        ref={zone}
        id={fieldId("cv")}
        type="button"
        aria-describedby={describedBy("cv", true, error)}
        onClick={() => input.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = [...e.dataTransfer.files];
          pick(pickDropped(files), files.length);
        }}
        className={`${ZONE} ${tone}`}
      >
        <span className="pointer-events-none text-base font-semibold text-action">{copy.zone}</span>
        <span aria-hidden="true" className="pointer-events-none text-sm text-muted">
          {file === null ? copy.zoneSub : copy.zoneReplace}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={CV_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          pick(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <p id="cv-hint" className="text-xs text-muted">
        {copy.formats}
      </p>
      <FieldError field="cv" message={error} alert={alert} />
      <div aria-live="polite" className="flex flex-col gap-2">
        {took !== null && <p className="text-sm text-ink [overflow-wrap:anywhere]">{took}</p>}
        {file !== null && (
          <FileRow
            file={file}
            copy={copy}
            onRemove={() => {
              setTook(null);
              onFile(null);
              zone.current?.focus();
            }}
          />
        )}
      </div>
    </>
  );
}
