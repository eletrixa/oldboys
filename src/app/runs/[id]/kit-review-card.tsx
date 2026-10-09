/**
 * "After the interview: paste the filled kit": shows which kit points the interview closed and which are still open (idea #23).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-review-card.tsx
 * Deps:    react, ../../ui (Radar tokens), ./kit-review, ./i18n (ReportLang type)
 * Tested:  n/a (parsing and texts are tested in __tests__/kit-review.test.ts)
 *
 * Key responsibilities:
 * - KitReviewCard: disclosure with a labelled textarea; for a parseable kit the answered / verified counts, the open
 *   points and a "Copy open points" button ("Copied" / "Copy failed" for 2 s, announced in an sr-only status span)
 * - Text without kit checklists: "This does not look like an interview kit from this page."
 * - Reads English and Czech kits; the copied open points are in the report language (`lang`), the card's own labels stay English
 *
 * Design constraints:
 * - Client only and private: the pasted kit and its notes never leave the browser (no fetch, no storage); local state only
 * - Never shows, reads or scores the notes' content; only whether a point was ticked or has notes
 */
"use client";

import { useId, useState } from "react";
import { BTN_SECONDARY, Chevron, FIELD, SUMMARY } from "../../ui";
import type { ReportLang } from "./i18n";
import { isKit, openPointsText, parseFilledKit, reviewSummary } from "./kit-review";

type CopyStatus = "idle" | "copied" | "failed";

const STATUS_LABEL: Record<Exclude<CopyStatus, "idle">, string> = { copied: "Copied", failed: "Copy failed" };

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

export function KitReviewCard({ lang }: { lang: ReportLang }): React.JSX.Element {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<CopyStatus>("idle");
  const fieldId = useId();
  const review = parseFilledKit(text);
  const summary = reviewSummary(review);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(openPointsText(review, lang));
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => {
      setStatus("idle");
    }, 2000);
  };

  return (
    <details className="group">
      <summary className={SUMMARY}>
        <Chevron />
        After the interview: paste the filled kit
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <label htmlFor={fieldId} className="text-sm font-medium text-ink">
          Filled interview kit (Markdown)
        </label>
        <textarea
          id={fieldId}
          className={`${FIELD} font-mono text-sm`}
          rows={8}
          placeholder="Paste the kit here after the interview. Tick boxes with [x] or write notes; unticked points without notes stay open."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <p className="text-xs text-muted">Your notes stay in this browser; nothing is saved.</p>
        {text.trim() === "" ? null : isKit(review) ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink">
              Answered {summary.answered} of {plural(summary.questions, "interview question")} · verified {summary.verified} of{" "}
              {plural(summary.checks, "check")}
            </p>
            {summary.open.length === 0 ? (
              <p className="text-sm text-muted">Every point from the kit was covered in the interview.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">Still open</p>
                <ul className="list-disc pl-5 text-sm text-ink">
                  {summary.open.map((point, i) => (
                    <li key={`${String(i)}-${point}`}>{point}</li>
                  ))}
                </ul>
              </>
            )}
            <div>
              <button type="button" className={BTN_SECONDARY} onClick={() => void copy()}>
                {status === "idle" ? "Copy open points" : STATUS_LABEL[status]}
              </button>
              <span role="status" className="sr-only">
                {status === "idle" ? "" : STATUS_LABEL[status]}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">This does not look like an interview kit from this page.</p>
        )}
      </div>
    </details>
  );
}
