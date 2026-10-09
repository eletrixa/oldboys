/**
 * The CV drop zone: one button that opens the file picker and takes a dropped file, plus the chosen file row.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/cv-drop.tsx
 * Deps:    react, ./apply-fields, ./apply-parts, ./apply-copy, ./cv-file-row
 * Tested:  helpers in src/app/apply/[tag]/__tests__/apply-fields.test.ts; the widget in the browser QA (specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - Pick by click, keyboard or drag-and-drop (zone highlighted while a file is over it); a second file replaces the first
 * - Type and size checked the moment a file is chosen (`cvFileProblem`); a refused file never replaces a good one, and
 *   the refusal names both files (`cvRefusal`) while the zone keeps its neutral border
 * - Shows the chosen file (cv-file-row.tsx); its Remove hands focus back to the zone
 * - Stops a file dropped beside the zone from navigating the tab away (the draft would be lost)
 *
 * Design constraints:
 * - The hidden input has no name, so FormData never carries a stale file; the form adds the chosen one itself
 * - Children of the zone ignore pointer events, so dragleave fires only when the file leaves the zone
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { ApplyCopy } from "./apply-copy";
import { CV_ACCEPT, cvFileProblem } from "./apply-fields";
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
  onReject: (problem: "type" | "size", picked: string, kept: string | null) => void;
  copy: Copy;
};

const ZONE = "flex min-h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none";

/** Keep a stray drop from opening the file in the tab and throwing the filled form away. */
function useNoStrayDrop(): void {
  useEffect(() => {
    const stop = (e: DragEvent): void => {
      if (e.dataTransfer?.types.includes("Files") === true) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);
}

export function CvDrop({ file, onFile, error, alert, onReject, copy }: Readonly<Props>): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);
  useNoStrayDrop();

  function pick(picked: File | undefined): void {
    if (picked === undefined) return;
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
          pick(e.dataTransfer.files[0]);
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
      <div aria-live="polite">
        {file !== null && (
          <FileRow
            file={file}
            copy={copy}
            onRemove={() => {
              onFile(null);
              zone.current?.focus();
            }}
          />
        )}
      </div>
    </>
  );
}
