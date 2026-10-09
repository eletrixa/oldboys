/**
 * Apply form: name, email, LinkedIn and/or CV (file or pasted text) and an optional message, sent to /api/apply.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/apply-form.tsx
 * Deps:    react, ./apply-fields, ./apply-copy, ./apply-parts, ./cv-field, ./post-form, ./use-draft
 * Tested:  src/app/apply/[tag]/__tests__/apply-fields.test.ts (validation, reply mapping); submit path via src/app/api/apply/__tests__/apply.test.ts
 *
 * Key responsibilities:
 * - checkApplyAll (state in use-draft.ts): every invalid field marked at once, the first focused and announced; name,
 *   email and LinkedIn re-checked on blur (filled ones only); a marked field clears as it is fixed
 * - Send through `sendApplication` (post-form.ts) with a progress bar, "Checking your CV" after the upload, a timeout
 *   after 90 s without progress
 * - One send at a time: a synchronous ref guard, so a double tap never sends twice; while sending the fields are
 *   disabled (the draft was already taken) and focus rests on the send button, which stays focusable (aria-disabled)
 * - Network error or 5xx: the sentence, and the send button reads "Try again" and resubmits the same, untouched draft;
 *   a 400 about the CV file (`field: "cv"`) shows under the file row instead; any edit or CV change clears either
 * - LinkedIn and CV under one line saying one of them is enough; only the message is marked optional
 * - Done card naming the reply address, what was attached and when to expect a reply
 *
 * Design constraints:
 * - Client component; no token, no run id and no application id ever reaches or leaves it
 * - Honeypot `hp_contact` (Honeypot in apply-parts.tsx), and the time since the first render goes along as `fill_ms`
 * - noValidate: never a browser validation popup; copy from apply-copy in the page's language, no emoji, never mentions research
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { COPY, type Lang } from "./apply-copy";
import { checkApplyAll, MESSAGE_MAX, type SendFailure } from "./apply-fields";
import { CONTROL, DoneCard, Field, Honeypot, SendFooter } from "./apply-parts";
import { CvField } from "./cv-field";
import { sendApplication } from "./post-form";
import { useDraft } from "./use-draft";

type Stage = { kind: "editing" } | { kind: "sending"; percent: number } | { kind: "done"; email: string; attached: string };
type Props = { tag: string; lang: Lang; privacy: { line: string; href: string } };

export function ApplyForm({ tag, lang, privacy }: Readonly<Props>): React.JSX.Element {
  const copy = COPY[lang];
  const formRef = useRef<HTMLFormElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const trapRef = useRef<HTMLInputElement>(null);
  const shownAt = useRef(0);
  const busy = useRef(false);
  const [stage, setStage] = useState<Stage>({ kind: "editing" });
  const [failure, setFailure] = useState<SendFailure | null>(null);
  // A failed send's sentence describes that send: any edit or CV change clears it (the button reads Send again).
  const d = useDraft(formRef, lang, () => {
    setFailure(null);
  });
  const { cv } = d;
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  async function submit(): Promise<void> {
    if (busy.current) return; // synchronous: a second tap lands before React re-renders the disabled button
    const draft = d.draftOf();
    const problems = checkApplyAll(draft, lang);
    if (problems.length > 0) {
      setFailure(null);
      d.markAll(problems);
      return;
    }
    busy.current = true;
    sendRef.current?.focus(); // the fields are disabled next; focus stays on the button that reads "Sending…"
    d.clear();
    setFailure(null);
    setStage({ kind: "sending", percent: 0 });
    const trap = { input: trapRef.current, fillMs: Date.now() - shownAt.current };
    const result = await sendApplication({ tag, lang, draft, trap }, (percent) => {
      setStage({ kind: "sending", percent });
    }).finally(() => {
      busy.current = false;
    });
    if (result.kind === "done") {
      setStage({ kind: "done", email: draft.email.trim(), attached: result.attached });
      return;
    }
    setFailure(result);
    setStage({ kind: "editing" });
  }

  if (stage.kind === "done") return <DoneCard email={stage.email} attached={stage.attached} copy={copy.done} />;

  const hasCv = cv.mode === "file" ? cv.file !== null : cv.text.trim() !== "";
  const sending = stage.kind === "sending";
  const cvFailure = failure?.field === "cv" ? failure.message : null;

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-5"
      aria-label={copy.form.label}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      {...d.formEvents}
    >
      <fieldset disabled={sending} className="flex min-w-0 flex-col gap-5">
        <Field {...d.shell("name")} label={copy.form.name}>
          <input {...d.fieldProps("name")} type="text" autoComplete="name" maxLength={200} className={CONTROL} />
        </Field>
        <Field {...d.shell("email")} label={copy.form.email}>
          <input {...d.fieldProps("email")} type="email" autoComplete="email" maxLength={200} className={CONTROL} />
        </Field>
        <div role="group" aria-labelledby="either-note" className="flex min-w-0 flex-col gap-5">
          <p id="either-note" className="-mb-2 text-sm text-muted">
            {copy.form.either}
          </p>
          <Field {...d.shell("linkedinUrl")} label={copy.form.linkedin}>
            {/* type="text" with a url keyboard (the browser would reject "linkedin.com/in/..." without https); no autofill: it offers a personal site */}
            <input {...d.fieldProps("linkedinUrl")} type="text" inputMode="url" autoComplete="off" maxLength={500} placeholder={copy.form.linkedinPlaceholder} className={CONTROL} />
          </Field>
          <CvField
            {...cv}
            {...d.cvEvents}
            errors={{ cv: d.errorFor("cv") ?? cvFailure, cvText: d.errorFor("cvText") }}
            alert={d.alertOn === "cv" || d.alertOn === "cvText" ? d.alertOn : cvFailure !== null ? "cv" : null}
            refused={cvFailure !== null}
            copy={{ legend: copy.form.cv, cv: copy.cv }}
          />
        </div>
        <Field {...d.shell("coverLetter")} label={copy.form.message} optional={copy.form.optional}>
          <textarea {...d.fieldProps("coverLetter")} rows={4} maxLength={MESSAGE_MAX} className={CONTROL} />
        </Field>
      </fieldset>
      <Honeypot inputRef={trapRef} />
      <SendFooter
        copy={copy}
        sendRef={sendRef}
        failure={failure !== null && failure.field === undefined ? failure : null}
        percent={sending ? stage.percent : null}
        checking={hasCv ? copy.progress.checkingCv : copy.progress.checkingDetails}
        privacy={privacy}
      />
    </form>
  );
}
