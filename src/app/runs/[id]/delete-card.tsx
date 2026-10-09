/**
 * "Delete candidate data" on the run page: choose a reason, confirm in the page, then show the deletion receipt (idea #17).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/delete-card.tsx
 * Deps:    react, next/link, src/app/ui (Radar tokens), src/app/login/next-path, src/domain/{deletion,audit}, ./delete-data
 * Tested:  n/a (answer mapping in __tests__/delete-data.test.ts, receipt and note text in src/domain/__tests__/deletion.test.ts)
 *
 * Key responsibilities:
 * - DeleteCard: a closed disclosure (opened by the #delete-data hash, e.g. from the audit page); step 1 picks the reason,
 *   step 2 lists what is deleted and what remains, needs a ticked "I understand" box, then "Delete everything now" (danger tone) sends it
 * - 401 shows the login link like the call panel; 403 / 404 / 409 / 502 and network errors in plain words (role="alert")
 * - DeletedView: replaces the page after success with the receipt line, "Copy deletion note" (plain text for the ATS)
 *   and links back to the briefs list and home
 *
 * Design constraints:
 * - Client only; no window.confirm, no alert(); the receipt and the note hold no personal data
 * - Visible for every run, whatever its status: a running research is stopped by the route before the delete
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loginHref } from "@/app/login/next-path";
import { RETENTION_DAYS } from "@/domain/audit";
import { DeleteReason, deletionNote, PROVIDER_RETENTION, REASON_LABEL, receiptLine, type DeletionReceipt } from "@/domain/deletion";
import { BTN_DANGER, BTN_QUIET, BTN_SECONDARY, CARD, CARD_CONFLICT, Chevron, Eyebrow, LINK, SUMMARY } from "../../ui";
import { requestDelete } from "./delete-data";

export const DELETE_ANCHOR = "delete-data";

type Step =
  | { kind: "choose"; reason: DeleteReason | null }
  | { kind: "confirm"; reason: DeleteReason }
  | { kind: "deleting"; reason: DeleteReason };
type Problem = { kind: "none" } | { kind: "unauthorized" } | { kind: "error"; message: string };

const GOES = ["Raw sources and saved copies", "The ledger and claims", "The brief", "Call results", "The application and the CV file"];
const REMAINS = "Nothing about this candidate stays in the research tool. You get a receipt with counts only, no personal data.";

export function DeleteCard({ runId, onDeleted }: { runId: string; onDeleted: (receipt: DeletionReceipt) => void }): React.JSX.Element {
  const [open] = useState(() => window.location.hash === `#${DELETE_ANCHOR}`);
  const ref = useRef<HTMLDetailsElement>(null);
  const [step, setStep] = useState<Step>({ kind: "choose", reason: null });
  const [problem, setProblem] = useState<Problem>({ kind: "none" });
  const [sure, setSure] = useState(false);

  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "start" });
  }, [open]);

  async function send(reason: DeleteReason): Promise<void> {
    setStep({ kind: "deleting", reason });
    setProblem({ kind: "none" });
    const outcome = await requestDelete(runId, reason);
    if (outcome.kind === "deleted") {
      onDeleted(outcome.receipt);
      return;
    }
    setProblem(outcome);
    setStep({ kind: "confirm", reason });
  }

  return (
    <details ref={ref} id={DELETE_ANCHOR} open={open} className="group border-t border-divider pt-4 print:hidden">
      <summary className={SUMMARY}>
        <Chevron />
        Delete candidate data
      </summary>
      <div className={`${CARD} mt-4 flex flex-col gap-4`}>
        <p className="text-sm text-muted">
          Use this when the candidate is rejected or asks us to delete their data. Otherwise everything is deleted automatically{" "}
          {String(RETENTION_DAYS)} days after the research.
        </p>
        {step.kind === "choose" ? (
          <ReasonStep reason={step.reason} onPick={(reason) => { setStep({ kind: "choose", reason }); }} onNext={(reason) => { setStep({ kind: "confirm", reason }); }} />
        ) : (
          <div className={`${CARD_CONFLICT} flex flex-col gap-3`}>
            <p className="text-sm text-ink">
              <span className="font-semibold">Reason:</span> {REASON_LABEL[step.reason]}
            </p>
            <div className="text-sm text-ink">
              <p className="font-semibold">What is deleted, all at once</p>
              <ul className="mt-1 list-disc pl-5">
                {GOES.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <p className="mt-2 font-semibold">What remains</p>
              <p>{REMAINS}</p>
              <p className="mt-2 text-conflict">This cannot be undone.</p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
              <input type="checkbox" checked={sure} onChange={(e) => { setSure(e.target.checked); }} className="size-4 accent-conflict" />
              I understand this cannot be undone.
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_DANGER} disabled={step.kind === "deleting" || !sure} onClick={() => void send(step.reason)}>
                {step.kind === "deleting" ? "Deleting…" : "Delete everything now"}
              </button>
              <button type="button" className={BTN_QUIET} disabled={step.kind === "deleting"} onClick={() => { setStep({ kind: "choose", reason: step.reason }); setProblem({ kind: "none" }); setSure(false); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {problem.kind === "error" && <p role="alert" className="text-sm text-conflict">{problem.message}</p>}
        {problem.kind === "unauthorized" && (
          <p role="alert" className="text-sm text-conflict">
            Your login has expired.{" "}
            <Link href={loginHref(`/runs/${runId}`)} className={LINK}>Log in again.</Link>
          </p>
        )}
      </div>
    </details>
  );
}

function ReasonStep({ reason, onPick, onNext }: {
  reason: DeleteReason | null;
  onPick: (reason: DeleteReason) => void;
  onNext: (reason: DeleteReason) => void;
}): React.JSX.Element {
  return (
    <>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 text-sm font-semibold text-ink">Why are you deleting it?</legend>
        {DeleteReason.options.map((r) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
            <input type="radio" name="delete-reason" value={r} checked={reason === r} onChange={() => { onPick(r); }} className="size-4 accent-conflict" />
            {REASON_LABEL[r]}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className={`${BTN_SECONDARY} self-start disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={reason === null}
        onClick={() => { if (reason !== null) onNext(reason); }}
      >
        Continue
      </button>
    </>
  );
}

type CopyStatus = "idle" | "copied" | "failed";
const COPY_LABEL: Record<CopyStatus, string> = { idle: "Copy deletion note", copied: "Copied", failed: "Copy failed" };

/** Replaces the run page after a successful delete; nothing about the candidate is left to show. */
export function DeletedView({ receipt }: { receipt: DeletionReceipt }): React.JSX.Element {
  const [copy, setCopy] = useState<CopyStatus>("idle");

  async function copyNote(): Promise<void> {
    try {
      await navigator.clipboard.writeText(deletionNote(receipt));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => { setCopy("idle"); }, 2000);
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-10 md:py-14">
      <Eyebrow>Deleted</Eyebrow>
      <h1 className="font-serif text-4xl leading-[1.05] md:text-5xl">Candidate data deleted</h1>
      <p className="text-ink">{receiptLine(receipt)}</p>
      <p className="text-sm text-muted">
        Nothing about this candidate is kept in the research tool. Paste the deletion note into the candidate&apos;s card in your ATS as a record; it holds no personal data.
      </p>
      {receipt.counts.calls > 0 && <p className="text-sm text-muted">{PROVIDER_RETENTION}</p>}
      <button type="button" className={BTN_SECONDARY} onClick={() => void copyNote()}>
        {COPY_LABEL[copy]}
      </button>
      <span role="status" className="sr-only">{copy === "idle" ? "" : COPY_LABEL[copy]}</span>
      <div className="flex items-center gap-6 self-stretch border-t border-divider pt-6 text-sm">
        <Link href="/briefs" className={LINK}>Back to my briefs</Link>
        <Link href="/" className={LINK}>Back to home</Link>
      </div>
    </main>
  );
}
