/**
 * The chosen CV file as one row: kind badge, name, size, kind label and a Remove button; an older .doc gets a note.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/cv-file-row.tsx
 * Deps:    src/app/ui (BTN_QUIET), ./apply-fields (fileKind, formatSize), ./apply-copy
 * Tested:  helpers in src/app/apply/[tag]/__tests__/apply-fields.test.ts; the row in the browser QA (specs/intake/apply-page.md)
 *
 * Key responsibilities:
 * - Name (truncated), "1.2 MB · PDF", Remove (>= 44px, names the file for screen readers)
 * - The .doc note: kept but not read, so LinkedIn is needed beside it
 *
 * Design constraints:
 * - Presentational, no hooks; Radar tokens only
 */
import { BTN_QUIET } from "@/app/ui";
import type { ApplyCopy } from "./apply-copy";
import { fileKind, formatSize } from "./apply-fields";

type Copy = ApplyCopy["cv"];

export function FileRow({ file, onRemove, copy }: Readonly<{ file: File; onRemove: () => void; copy: Copy }>): React.JSX.Element {
  const kind = fileKind(file);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-divider bg-surface py-2 pr-1 pl-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-sage text-xs font-semibold text-ink uppercase">
          {kind ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
          <p className="text-xs text-muted tabular-nums">
            {formatSize(file.size)} · {kind === null ? copy.unknownKind : copy.kind[kind]}
          </p>
        </div>
        <button type="button" onClick={onRemove} aria-label={copy.removeLabel(file.name)} className={BTN_QUIET}>
          {copy.remove}
        </button>
      </div>
      {kind === "doc" && <p className="pr-2 pb-1 text-xs text-muted">{copy.docNote}</p>}
    </div>
  );
}
