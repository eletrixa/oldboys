/**
 * POST /api/apply logic: the hosted apply page's multipart form becomes one IntakeInput for the intake funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/apply/handler.ts
 * Deps:    src/workflow/intake, src/domain (application, digest), src/app/apply/[tag]/apply-fields, src/app/_lib/form-text, src/app/api/_lib/same-origin
 * Tested:  src/app/api/apply/__tests__/apply.test.ts
 *
 * Key responsibilities:
 * - Same-origin check (403), multipart parse, silent honeypot drop, validation (400)
 * - One application per (tag, email): externalId = sha256(tag|lowercased email), so a resubmit is a duplicate
 * - Answer 201 `{received: true}` for every stored outcome (new, duplicate, unmatched, incomplete), 429 for `capped`,
 *   500 on a funnel failure; the honeypot gets 200
 *
 * Design constraints:
 * - Takes bindings as parameters so Vitest runs it under plain Node
 * - The candidate never learns an application id, status or run id: the body is `{received: true}` or `{error}`
 * - An unknown tag is stored as `unmatched` and answered like a success (no tag oracle through the API)
 */
import { checkApply, MESSAGES } from "@/app/apply/[tag]/apply-fields";
import { formText } from "@/app/_lib/form-text";
import { rejectCrossOrigin } from "@/app/api/_lib/same-origin";
import { CV_MAX_BYTES, IntakeTag, toCvFile } from "@/domain/application";
import { sha256Hex } from "@/domain/digest";
import { ingestApplication, type IntakeEnv } from "@/workflow/intake";

/** CV limit plus room for the other multipart fields; a larger declared body is refused before it is buffered. */
const BODY_MAX_BYTES = CV_MAX_BYTES + 256 * 1024;

const bad = (error: string): Response => Response.json({ error }, { status: 400 });
const received = (status: 200 | 201): Response => Response.json({ received: true }, { status });

export async function handleApply(request: Request, env: IntakeEnv, now: Date): Promise<Response> {
  const denied = rejectCrossOrigin(request);
  if (denied) return denied;

  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > BODY_MAX_BYTES) return bad(MESSAGES.cvSize);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("We could not read that form. Please reload the page and try again.");
  }

  // Bots fill every field: pretend it worked and store nothing.
  if (formText(form, "website") !== "") return received(200);

  const tag = IntakeTag.safeParse(formText(form, "tag"));
  if (!tag.success) return bad("This position link is not valid.");

  const file = form.get("cv");
  const cv = file instanceof File && (file.size > 0 || file.name !== "") ? file : null;
  const draft = {
    name: formText(form, "name"),
    email: formText(form, "email"),
    linkedinUrl: formText(form, "linkedinUrl"),
    cv,
    message: formText(form, "coverLetter"),
  };
  const problem = checkApply(draft);
  if (problem !== null) return bad(problem);
  const email = draft.email.trim();

  try {
    const result = await ingestApplication(
      {
        source: "apply-page",
        externalId: await sha256Hex(`${tag.data}|${email.toLowerCase()}`),
        tag: tag.data,
        name: draft.name,
        email,
        ...(draft.linkedinUrl.trim() === "" ? {} : { linkedinUrl: draft.linkedinUrl.trim() }),
        ...(draft.message.trim() === "" ? {} : { coverLetter: draft.message }),
        ...(cv === null ? {} : { cv: toCvFile({ bytes: await cv.arrayBuffer(), filename: cv.name, contentType: cv.type }) }),
      },
      env,
      now,
    );
    if (result.status === "capped") return Response.json({ error: "too many applications" }, { status: 429 });
    // 201 for duplicates too: a different code would tell a stranger that this email already applied.
    return received(201);
  } catch (err) {
    console.error("apply: intake failed", err);
    return Response.json({ error: "We could not save your application. Please try again in a few minutes." }, { status: 500 });
  }
}
