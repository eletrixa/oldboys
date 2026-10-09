/**
 * Multipart POST over XMLHttpRequest with upload progress and a timeout, and the apply form's send built on it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/post-form.ts
 * Deps:    browser XMLHttpRequest, ./apply-fields (attachedLine, replyOutcome, HONEYPOT, FILL_MS), ./apply-copy
 * Tested:  src/app/apply/[tag]/__tests__/post-form.test.ts (a fake XMLHttpRequest under Node)
 *
 * Key responsibilities:
 * - `postForm(url, data, onProgress)`: resolves `{status, body}` for any HTTP answer (body = parsed JSON or null),
 *   rejects with `PostFailure` "network" or "timeout"; reports upload percent 0..100, and 100 once the body is sent
 * - The timeout is for silence, not for the whole send: POST_IDLE_MS without upload progress or an answer, so a 10 MB
 *   CV on a slow phone line finishes (and Try again is never a wall the same file hits again)
 * - `sendApplication`: the multipart body built from the draft (fields, tag, the CV file or pasted text, the honeypot
 *   and the fill time), the POST in the page's language and what the candidate sees: done with the attached line, or
 *   the sentence, whether to retry and the field it belongs to (`cv`); a trapped send (200) clears the honeypot so the
 *   retry goes through
 *
 * Design constraints:
 * - XMLHttpRequest, not fetch: fetch has no upload progress
 * - Client only; never sets Content-Type (the browser writes the multipart boundary)
 * - The body is the draft as it was at Send, never the live form: an edit during the upload is not half-sent
 */
import { COPY, type Lang } from "./apply-copy";
import { attachedLine, FILL_MS, HONEYPOT, replyOutcome, type ApplyDraft, type SendFailure } from "./apply-fields";

/** Longest silence (no upload progress, no answer) before a send counts as timed out. */
export const POST_IDLE_MS = 90_000;

export class PostFailure extends Error {
  constructor(readonly reason: "network" | "timeout") {
    super(reason);
  }
}

export type PostReply = { status: number; body: unknown };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function postForm(url: string, data: FormData, onProgress: (percent: number) => void): Promise<PostReply> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let idle: ReturnType<typeof setTimeout> | undefined;
    const settle = (fn: () => void): void => {
      clearTimeout(idle);
      fn();
    };
    // Restarted by every progress event: a slow upload that keeps moving never times out, a stalled one does.
    const arm = (): void => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        settle(() => {
          reject(new PostFailure("timeout"));
        });
        xhr.abort();
      }, POST_IDLE_MS);
    };
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      arm();
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.upload.onload = () => {
      arm();
      onProgress(100);
    };
    xhr.onload = () => {
      settle(() => {
        resolve({ status: xhr.status, body: parseJson(xhr.responseText) });
      });
    };
    xhr.onerror = () => {
      settle(() => {
        reject(new PostFailure("network"));
      });
    };
    xhr.onabort = xhr.onerror;
    arm();
    xhr.send(data);
  });
}

export type SendResult = { kind: "done"; attached: string } | ({ kind: "error" } & SendFailure);

/** The honeypot input; a 200 answer means it (or the fill time) trapped a real send, so it is cleared for the retry. */
type Trap = { input: HTMLInputElement | null; fillMs: number };

type Send = { tag: string; lang: Lang; draft: ApplyDraft; trap: Trap };

/** The multipart body: the draft's fields, the visible CV mode's file or text, the honeypot and the fill time. */
export function applicationBody({ tag, draft, trap }: Omit<Send, "lang">): FormData {
  const data = new FormData();
  data.set("tag", tag);
  data.set("name", draft.name);
  data.set("email", draft.email);
  data.set("linkedinUrl", draft.linkedinUrl);
  data.set("coverLetter", draft.message);
  // The visible mode decides: the file in file mode, the text in paste mode (draftOf already blanked the other).
  if (draft.cv !== null) data.set("cv", draft.cv);
  else if (draft.cvText.trim() !== "") data.set("cvText", draft.cvText);
  data.set(HONEYPOT, trap.input?.value ?? "");
  data.set(FILL_MS, String(Math.round(trap.fillMs)));
  return data;
}

export async function sendApplication({ tag, lang, draft, trap }: Send, onProgress: (percent: number) => void): Promise<SendResult> {
  const data = applicationBody({ tag, draft, trap });
  try {
    const reply = await postForm(`/api/apply${lang === "en" ? "" : `?lang=${lang}`}`, data, onProgress);
    const outcome = replyOutcome(reply.status, reply.body, lang);
    if (reply.status === 200 && trap.input !== null) trap.input.value = "";
    if (outcome.kind === "error") return outcome;
    const sent = { cvName: draft.cv?.name ?? null, pastedCv: data.has("cvText"), linkedin: draft.linkedinUrl.trim() !== "" };
    return { kind: "done", attached: attachedLine(sent, lang) };
  } catch (err) {
    const m = COPY[lang].messages;
    return { kind: "error", message: err instanceof PostFailure && err.reason === "timeout" ? m.timeout : m.offline, retry: true };
  }
}
