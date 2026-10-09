/**
 * Multipart POST over XMLHttpRequest with upload progress and a timeout, and the apply form's send built on it.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/post-form.ts
 * Deps:    browser XMLHttpRequest, ./apply-fields (attachedLine, replyOutcome), ./apply-copy
 * Tested:  n/a (browser transport; the response mapping is replyOutcome in apply-fields.test.ts, the server is apply.test.ts)
 *
 * Key responsibilities:
 * - `postForm(url, data, onProgress)`: resolves `{status, body}` for any HTTP answer (body = parsed JSON or null),
 *   rejects with `PostFailure` "network" or "timeout"; reports upload percent 0..100, and 100 once the body is sent
 * - `sendApplication`: the multipart body (form fields, tag, the draft's CV file or pasted text), the POST in the
 *   page's language and what the candidate sees: done with the attached line, or the sentence and whether to retry
 *
 * Design constraints:
 * - XMLHttpRequest, not fetch: fetch has no upload progress
 * - Client only; never sets Content-Type (the browser writes the multipart boundary)
 */
import { COPY, type Lang } from "./apply-copy";
import { attachedLine, replyOutcome, type ApplyDraft } from "./apply-fields";

export const POST_TIMEOUT_MS = 90_000;

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
    xhr.open("POST", url);
    xhr.timeout = POST_TIMEOUT_MS;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.upload.onload = () => {
      onProgress(100);
    };
    xhr.onload = () => {
      resolve({ status: xhr.status, body: parseJson(xhr.responseText) });
    };
    xhr.onerror = () => {
      reject(new PostFailure("network"));
    };
    xhr.onabort = xhr.onerror;
    xhr.ontimeout = () => {
      reject(new PostFailure("timeout"));
    };
    xhr.send(data);
  });
}

export type SendResult = { kind: "done"; attached: string } | { kind: "error"; message: string; retry: boolean };

type Send = { tag: string; lang: Lang; draft: ApplyDraft };

export async function sendApplication(form: HTMLFormElement | null, { tag, lang, draft }: Send, onProgress: (percent: number) => void): Promise<SendResult> {
  const data = new FormData(form ?? undefined);
  data.set("tag", tag);
  if (draft.cv !== null) data.set("cv", draft.cv);
  // The visible mode decides: the file in file mode, the text in paste mode (draftOf already blanked the other).
  if (draft.cv !== null || draft.cvText.trim() === "") data.delete("cvText");
  else data.set("cvText", draft.cvText);
  try {
    const reply = await postForm(`/api/apply${lang === "en" ? "" : `?lang=${lang}`}`, data, onProgress);
    const outcome = replyOutcome(reply.status, reply.body, lang);
    if (outcome.kind === "error") return outcome;
    const sent = { cvName: draft.cv?.name ?? null, pastedCv: data.has("cvText"), linkedin: draft.linkedinUrl.trim() !== "" };
    return { kind: "done", attached: attachedLine(sent, lang) };
  } catch (err) {
    const m = COPY[lang].messages;
    return { kind: "error", message: err instanceof PostFailure && err.reason === "timeout" ? m.timeout : m.offline, retry: true };
  }
}
