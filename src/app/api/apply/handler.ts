/**
 * POST /api/apply logic: the hosted apply page's multipart form becomes one IntakeInput for the intake funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/apply/handler.ts
 * Deps:    src/workflow/intake, src/domain (application, cv-kind, cv-text, digest), src/app/apply/[tag]/apply-fields,
 *          src/app/apply/[tag]/apply-copy, src/app/_lib/form-text, src/app/api/_lib/same-origin, binding APPLY_RATE_LIMIT
 * Tested:  src/app/api/apply/__tests__/apply.test.ts
 *
 * Key responsibilities:
 * - Same-origin check (403), per-IP rate limit (429, the `APPLY_RATE_LIMIT` binding), a declared body size required and
 *   capped before anything is buffered (400), multipart parse, silent bot drop (honeypot `hp_contact` filled, or sent
 *   under MIN_FILL_MS after the page rendered: 200), validation (400) in the page's language (`?lang=cs`)
 * - CV as a PDF / DOCX / TXT file (stored under its canonical media type), an older .doc stored beside LinkedIn, or
 *   pasted `cvText`; a file wins over text. The kind is the bytes' magic when they carry one (`sniffCvKind`). The file's
 *   text is read here, before answering: a file without readable text and no LinkedIn profile is a 400 the candidate
 *   can fix, never a "Received" that goes nowhere; with LinkedIn the funnel gets the reason (`cvNote`), not a 2nd parse
 * - One application per (tag, email): externalId = sha256(tag|lowercased email), so a resubmit is a duplicate
 * - Answer 201 `{received: true}` for every stored outcome (new, duplicate, unmatched, capped: the cron starts a capped
 *   run later); 503 while an earlier send of the same application is still being stored, or its retry lost the race,
 *   so the candidate retries until something is stored; 500 on a funnel failure; the honeypot gets 200
 *
 * Design constraints:
 * - Takes bindings as parameters so Vitest runs it under plain Node
 * - The candidate never learns an application id, status or run id: the body is `{received: true}` or `{error}`
 * - An unknown tag is stored as `unmatched` and answered like a success (no tag oracle through the API; the page
 *   itself 404s an unknown tag on purpose, so a candidate with a mistyped link learns it before filling anything in)
 * - Browsers always declare Content-Length for a FormData body; a chunked body (no length) is refused, so nothing
 *   over the cap is ever buffered
 * - Never a rate-limit answer: the hourly cap is ours to queue, not the candidate's to wait out
 */
import { COPY, toLang } from "@/app/apply/[tag]/apply-copy";
import { checkApply, FILL_MS, HONEYPOT, MIN_FILL_MS } from "@/app/apply/[tag]/apply-fields";
import { formText } from "@/app/_lib/form-text";
import { rejectCrossOrigin } from "@/app/api/_lib/same-origin";
import { CV_MAX_BYTES, IntakeTag, toCvFile } from "@/domain/application";
import { CV_MEDIA_TYPE, cvKind, sniffCvKind } from "@/domain/cv-kind";
import { extractCvText } from "@/domain/cv-text";
import { sha256Hex } from "@/domain/digest";
import { ingestApplication, type IntakeEnv } from "@/workflow/intake";

/** CV limit plus room for the other multipart fields; a larger declared body is refused before it is buffered. */
const BODY_MAX_BYTES = CV_MAX_BYTES + 256 * 1024;

const bad = (error: string): Response => Response.json({ error }, { status: 400 });
const received = (status: 200 | 201): Response => Response.json({ received: true }, { status });

/** The route's bindings: the funnel's, plus the per-IP limit (wrangler `ratelimits`; absent in unit tests). */
export type ApplyEnv = IntakeEnv & { APPLY_RATE_LIMIT?: RateLimit };

export async function handleApply(request: Request, env: ApplyEnv, now: Date): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied) return denied;
  const lang = toLang(new URL(request.url).searchParams.get("lang"));
  const m = COPY[lang].messages;

  // Every send stores a row and up to 10 MB in R2: one address gets a few per minute (the page shows "try again").
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.APPLY_RATE_LIMIT && !(await env.APPLY_RATE_LIMIT.limit({ key: ip })).success) return Response.json({ error: m.server }, { status: 429 });

  const length = request.headers.get("Content-Length");
  if (length === null || !/^\d+$/.test(length)) return bad(m.unreadableForm);
  if (Number(length) > BODY_MAX_BYTES) return bad(m.cvSize);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad(m.unreadableForm);
  }

  // Bots fill every field, or send at once: pretend it worked and store nothing (our own page shows "try again").
  const fillMs = Number(formText(form, FILL_MS));
  if (formText(form, HONEYPOT) !== "" || !(fillMs >= MIN_FILL_MS)) return received(200);

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

  // checkApply accepted the file, so it has a declared kind; the bytes' magic wins over it (a .docx typed as a PDF is
  // read and stored as Word), and the canonical type keeps a typeless .docx from the toCvFile PDF default.
  const declared = cv === null ? null : cvKind({ filename: cv.name, contentType: cv.type });
  const bytes = cv === null || declared === null ? null : await cv.arrayBuffer();
  const kind = bytes === null || declared === null ? null : sniffCvKind(bytes, declared);
  const cvFile = cv === null || bytes === null || kind === null ? null : toCvFile({ bytes, filename: cv.name, contentType: CV_MEDIA_TYPE[kind] });
  // A .doc is never read: it needs LinkedIn beside it (checkApply asked by its name; this asks by its bytes).
  if (kind === "doc" && linkedinUrl === "") return bad(m.cvDoc);
  // Read the file now so a scan without text is the candidate's to fix while the form is still open.
  const extracted = cvFile === null ? null : await extractCvText(cvFile);
  if (kind !== null && kind !== "doc" && extracted?.text === null && linkedinUrl === "") return bad(m.cvUnreadable[kind]);
  const cvText = cv === null ? draft.cvText.trim() : (extracted?.text ?? "");
  const cvNote = extracted?.text === null ? (extracted.note ?? undefined) : undefined;

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
        ...(cvNote === undefined ? {} : { cvNote }),
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
