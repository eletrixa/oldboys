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
 * - Send through `sendApplication` (post-form.ts) with a progress bar, "Checking your CV" after the upload, a 90 s timeout
 * - One send at a time: a synchronous ref guard, so a double tap never sends twice
 * - Network error or 5xx: the sentence plus "Try again", which resubmits the same, untouched draft
 * - Done card naming the reply address, what was attached and when to expect a reply
 *
 * Design constraints:
 * - Client component; no token, no run id and no application id ever reaches or leaves it
 * - Honeypot `website`, visually hidden, out of tab order and out of the accessibility tree
 * - noValidate: never a browser validation popup; copy from apply-copy in the page's language, no emoji, never mentions research
 */
"use client";

import { useRef, useState } from "react";
import { COPY, type Lang } from "./apply-copy";
import { checkApplyAll, cvRefusal, MESSAGE_MAX, type ApplyField } from "./apply-fields";
import { CONTROL, DoneCard, Field, SendFooter } from "./apply-parts";
import { CvField } from "./cv-field";
import { sendApplication } from "./post-form";
import { useDraft } from "./use-draft";

type Stage = { kind: "editing" } | { kind: "sending"; percent: number } | { kind: "done"; email: string; attached: string };
type Props = { tag: string; lang: Lang; privacy: { line: string; href: string } };

/** Fields checked again when they lose focus; the CV is checked as it changes. */
const ON_BLUR = new Set<string>(["name", "email", "linkedinUrl"]);
/** Controls the draft reads from the form itself; the CV's own handlers re-check with the new value. */
const FORM_FIELDS = new Set<string>([...ON_BLUR, "coverLetter"]);

export function ApplyForm({ tag, lang, privacy }: Readonly<Props>): React.JSX.Element {
  const copy = COPY[lang];
  const formRef = useRef<HTMLFormElement>(null);
  const busy = useRef(false);
  const [stage, setStage] = useState<Stage>({ kind: "editing" });
  const [failure, setFailure] = useState<{ message: string; retry: boolean } | null>(null);
  const d = useDraft(formRef, lang);
  const { cv } = d;

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
    d.clear();
    setFailure(null);
    setStage({ kind: "sending", percent: 0 });
    const result = await sendApplication(formRef.current, { tag, lang, draft }, (percent) => {
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
      onBlur={(e) => {
        const t = e.target;
        if (t instanceof HTMLInputElement && ON_BLUR.has(t.name) && (t.value.trim() !== "" || d.isMarked(t.name))) d.recheck({}, t.name as ApplyField);
      }}
      onChange={(e) => {
        const t = e.target as { name?: unknown };
        if (typeof t.name === "string" && FORM_FIELDS.has(t.name) && d.hasErrors) d.recheck();
      }}
    >
      <Field {...d.shell("name")} label={copy.form.name}>
        <input {...d.fieldProps("name")} type="text" autoComplete="name" maxLength={200} className={CONTROL} />
      </Field>
      <Field {...d.shell("email")} label={copy.form.email}>
        <input {...d.fieldProps("email")} type="email" autoComplete="email" maxLength={200} className={CONTROL} />
      </Field>
      <Field {...d.shell("linkedinUrl")} label={copy.form.linkedin} optional={copy.form.optional} hint={copy.form.linkedinHint}>
        {/* type="text" with a url keyboard: the browser would reject "linkedin.com/in/..." without https, the server accepts it */}
        <input {...d.fieldProps("linkedinUrl", true)} type="text" inputMode="url" autoComplete="url" maxLength={500} placeholder={copy.form.linkedinPlaceholder} className={CONTROL} />
      </Field>
      <CvField
        mode={cv.mode}
        onMode={(mode) => {
          cv.setMode(mode);
          d.recheck({ mode });
        }}
        file={cv.file}
        onFile={(file) => {
          cv.setFile(file);
          d.recheck({ file });
        }}
        text={cv.text}
        onText={(text) => {
          cv.setText(text);
          if (d.hasErrors) d.recheck({ text });
        }}
        errors={{ cv: d.errorFor("cv"), cvText: d.errorFor("cvText") }}
        alert={d.alertOn === "cv" || d.alertOn === "cvText" ? d.alertOn : null}
        onReject={(problem, picked, kept) => {
          d.mark("cv", cvRefusal(problem, picked, kept, lang));
        }}
        copy={{ legend: copy.form.cv, optional: copy.form.optional, cv: copy.cv }}
      />
      <Field {...d.shell("coverLetter")} label={copy.form.message} optional={copy.form.optional}>
        <textarea {...d.fieldProps("coverLetter")} rows={4} maxLength={MESSAGE_MAX} className={CONTROL} />
      </Field>
      <div aria-hidden="true" className="sr-only">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <SendFooter
        copy={copy}
        failure={failure}
        percent={stage.kind === "sending" ? stage.percent : null}
        checking={hasCv ? copy.progress.checkingCv : copy.progress.checkingDetails}
        privacy={privacy}
      />
    </form>
  );
}
