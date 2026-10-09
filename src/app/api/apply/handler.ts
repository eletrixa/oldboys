/**
 * POST /api/apply logic: the hosted apply page's multipart form becomes one IntakeInput for the intake funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/apply/handler.ts
 * Deps:    src/workflow/intake, src/domain (application, cv-kind, cv-text, digest), src/app/apply/[tag]/apply-fields,
 *          src/app/apply/[tag]/apply-copy, src/app/_lib/form-text, src/app/api/_lib/same-origin
 * Tested:  src/app/api/apply/__tests__/apply.test.ts
 *
 * Key responsibilities:
 * - Same-origin check (403), multipart parse, silent honeypot drop, validation (400) in the page's language (`?lang=cs`)
 * - CV as a PDF / DOCX / TXT file (stored under its canonical media type), an older .doc stored beside LinkedIn, or
 *   pasted `cvText`; a file wins over text. The file's text is read here, before answering: a file without readable
 *   text and no LinkedIn profile is a 400 the candidate can fix, never a "Received" that goes nowhere
 * - One application per (tag, email): externalId = sha256(tag|lowercased email), so a resubmit is a duplicate
 * - Answer 201 `{received: true}` for every stored outcome (new, duplicate, unmatched, capped: the cron starts a capped
 *   run later); 503 while an earlier send of the same application is still being stored, or its retry lost the race,
 *   so the candidate retries until something is stored; 500 on a funnel failure; the honeypot gets 200
 *
 * Design constraints:
 * - Takes bindings as parameters so Vitest runs it under plain Node
 * - The candidate never learns an application id, status or run id: the body is `{received: true}` or `{error}`
 * - An unknown tag is stored as `unmatched` and answered like a success (no tag oracle through the API)
 * - Never a rate-limit answer: the hourly cap is ours to queue, not the candidate's to wait out
 */
import { COPY, toLang } from "@/app/apply/[tag]/apply-copy";
import { checkApply } from "@/app/apply/[tag]/apply-fields";
import { formText } from "@/app/_lib/form-text";
import { rejectCrossOrigin } from "@/app/api/_lib/same-origin";
import { CV_MAX_BYTES, IntakeTag, toCvFile } from "@/domain/application";
import { CV_MEDIA_TYPE, cvKind } from "@/domain/cv-kind";
import { extractCvText } from "@/domain/cv-text";
import { sha256Hex } from "@/domain/digest";
import { ingestApplication, type IntakeEnv } from "@/workflow/intake";

/** CV limit plus room for the other multipart fields; a larger declared body is refused before it is buffered. */
const BODY_MAX_BYTES = CV_MAX_BYTES + 256 * 1024;

const bad = (error: string): Response => Response.json({ error }, { status: 400 });
const received = (status: 200 | 201): Response => Response.json({ received: true }, { status });

export async function handleApply(request: Request, env: IntakeEnv, now: Date): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied) return denied;
  const lang = toLang(new URL(request.url).searchParams.get("lang"));
  const m = COPY[lang].messages;

  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > BODY_MAX_BYTES) return bad(m.cvSize);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad(m.unreadableForm);
  }

  // Bots fill every field: pretend it worked and store nothing.
  if (formText(form, "website") !== "") return received(200);

  const tag = IntakeTag.safeParse(formText(form, "tag"));
  if (!tag.success) return bad(m.tag);

  const file = form.get("cv");
  const cv = file instanceof File && (file.size > 0 || file.name !== "") ? file : null;
  const draft = {
    name: formText(form, "name"),
    email: formText(form, "email"),
    linkedinUrl: formText(form, "linkedinUrl"),
    cv,
    cvText: formText(form, "cvText"),
    message: formText(form, "coverLetter"),
  };
  const problem = checkApply(draft, lang);
  if (problem !== null) return bad(problem.message);
  const email = draft.email.trim();
  const linkedinUrl = draft.linkedinUrl.trim();

  // checkApply accepted the file, so it has a kind; the canonical type keeps a typeless .docx from the PDF default.
  const kind = cv === null ? null : cvKind({ filename: cv.name, contentType: cv.type });
  const cvFile = cv === null || kind === null ? null : toCvFile({ bytes: await cv.arrayBuffer(), filename: cv.name, contentType: CV_MEDIA_TYPE[kind] });
  // Read the file now so a scan without text is the candidate's to fix while the form is still open.
  const extracted = cvFile === null ? null : await extractCvText(cvFile);
  // (A .doc is never read; checkApply already demanded LinkedIn beside it. With LinkedIn the funnel notes the file.)
  if (kind !== null && kind !== "doc" && extracted?.text === null && linkedinUrl === "") return bad(m.cvUnreadable[kind]);
  const cvText = cv === null ? draft.cvText.trim() : (extracted?.text ?? "");

  try {
    const result = await ingestApplication(
      {
        source: "apply-page",
        externalId: await sha256Hex(`${tag.data}|${email.toLowerCase()}`),
        tag: tag.data,
        name: draft.name,
        email,
        ...(linkedinUrl === "" ? {} : { linkedinUrl }),
        ...(draft.message.trim() === "" ? {} : { coverLetter: draft.message }),
        ...(cvText === "" ? {} : { cvText }),
        ...(cvFile === null ? {} : { cv: cvFile }),
      },
      env,
      now,
    );
    // An earlier send of this application is still being stored (or a racing retry won it): nothing new is stored
    // yet, so the candidate must not see "Received". The page offers Try again.
    if (result.status === "received") return Response.json({ error: m.server }, { status: 503 });
    // 201 for duplicates and capped rows too: a different code would tell a stranger that this email already applied.
    return received(201);
  } catch (err) {
    console.error("apply: intake failed", err);
    return Response.json({ error: m.server }, { status: 500 });
  }
}
