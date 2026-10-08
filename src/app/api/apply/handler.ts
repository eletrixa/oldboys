/**
 * POST /api/apply logic: the hosted apply page's multipart form becomes one IntakeInput for the intake funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/apply/handler.ts
 * Deps:    zod, src/workflow/intake, src/domain/application, src/app/apply/[tag]/apply-fields, src/app/api/_lib/origin
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
import { z } from "zod";
import { checkApply, CV_MAX_BYTES, MESSAGES } from "@/app/apply/[tag]/apply-fields";
import { fromOurPage } from "@/app/api/_lib/origin";
import { IntakeTag, type CvFile } from "@/domain/application";
import { ingestApplication, type IntakeEnv } from "@/workflow/intake";

export type ApplyEnv = IntakeEnv;

/** CV limit plus room for the other multipart fields; a larger declared body is refused before it is buffered. */
const BODY_MAX_BYTES = CV_MAX_BYTES + 256 * 1024;

const bad = (error: string): Response => Response.json({ error }, { status: 400 });
const received = (status: 200 | 201): Response => Response.json({ received: true }, { status });

export async function handleApply(request: Request, env: ApplyEnv, now: Date): Promise<Response> {
  if (!fromOurPage(request)) return Response.json({ error: "apply page only" }, { status: 403 });

  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > BODY_MAX_BYTES) return bad(MESSAGES.cvSize);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("We could not read that form. Please reload the page and try again.");
  }

  // Bots fill every field: pretend it worked and store nothing.
  if (text(form, "website") !== "") return received(200);

  const tag = IntakeTag.safeParse(text(form, "tag"));
  if (!tag.success) return bad("This position link is not valid.");

  const file = form.get("cv");
  const cv = file instanceof File && (file.size > 0 || file.name !== "") ? file : null;
  const draft = {
    name: text(form, "name"),
    email: text(form, "email"),
    linkedinUrl: text(form, "linkedinUrl"),
    cv,
    message: text(form, "coverLetter"),
  };
  const problem = checkApply(draft) ?? (z.email().safeParse(draft.email.trim()).success ? null : MESSAGES.email);
  if (problem !== null) return bad(problem);

  try {
    const result = await ingestApplication(
      {
        source: "apply-page",
        externalId: await sha256Hex(`${tag.data}|${draft.email.trim().toLowerCase()}`),
        tag: tag.data,
        name: draft.name,
        email: draft.email.trim(),
        ...(draft.linkedinUrl.trim() === "" ? {} : { linkedinUrl: draft.linkedinUrl.trim() }),
        ...(draft.message.trim() === "" ? {} : { coverLetter: draft.message }),
        ...(cv === null ? {} : { cv: await toCvFile(cv) }),
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

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

async function toCvFile(file: File): Promise<CvFile> {
  return { bytes: await file.arrayBuffer(), filename: file.name === "" ? "cv.pdf" : file.name, contentType: file.type === "" ? "application/pdf" : file.type };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
