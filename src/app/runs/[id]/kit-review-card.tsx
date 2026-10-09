/**
 * "After the interview: paste the filled kit": shows which kit points the interview closed and which are still open (idea #23).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/kit-review-card.tsx
 * Deps:    react, ../../ui (Radar tokens), ./kit-review, ./report-lang (useReport)
 * Tested:  n/a (parsing and texts are tested in __tests__/kit-review.test.ts)
 *
 * Key responsibilities:
 * - KitReviewCard: disclosure with a labelled textarea; for a parseable kit the answered / verified counts, the open
 *   points and a "Copy open points" button ("Copied" / "Copy failed" for 2 s, announced in an sr-only status span)
 * - Text without kit checklists: "This does not look like an interview kit from this page."
 * - Reads English and Czech kits; the copied open points and the card's own labels are in the report language (`report.t.kit`)
 *
 * Design constraints:
 * - Client only and private: the pasted kit and its notes never leave the browser (no fetch, no storage); local state only
 * - Never shows, reads or scores the notes' content; only whether a point was ticked or has notes
 */
"use client";

import { useId, useState } from "react";
import { BTN_SECONDARY, Chevron, FIELD, SUMMARY } from "../../ui";
import { isKit, openPointsText, parseFilledKit, reviewSummary } from "./kit-review";
import { useReport } from "./report-lang";

type CopyStatus = "idle" | "copied" | "failed";

export function KitReviewCard(): React.JSX.Element {
  const { lang, t: dict } = useReport();
  const t = dict.kit;
  const statusLabel = (s: Exclude<CopyStatus, "idle">): string => (s === "copied" ? t.copied : t.copyFailed);
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
        {t.reviewTitle}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <label htmlFor={fieldId} className="text-sm font-medium text-ink">
          {t.reviewLabel}
        </label>
        <textarea
          id={fieldId}
          className={`${FIELD} font-mono text-sm`}
          rows={8}
          placeholder={t.reviewPlaceholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <p className="text-xs text-muted">{t.reviewPrivate}</p>
        {text.trim() === "" ? null : isKit(review) ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink">{t.reviewCounts(summary.answered, summary.questions, summary.verified, summary.checks)}</p>
            {summary.open.length === 0 ? (
              <p className="text-sm text-muted">{t.reviewAllCovered}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">{t.reviewOpen}</p>
                <ul className="list-disc pl-5 text-sm text-ink">
                  {summary.open.map((point, i) => (
                    <li key={`${String(i)}-${point}`}>{point}</li>
                  ))}
                </ul>
              </>
            )}
            <div>
              <button type="button" className={BTN_SECONDARY} onClick={() => void copy()}>
                {status === "idle" ? t.copyOpen : statusLabel(status)}
              </button>
              <span role="status" className="sr-only">
                {status === "idle" ? "" : statusLabel(status)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">{t.notAKit}</p>
        )}
      </div>
    </details>
  );
}
