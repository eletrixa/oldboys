/**
 * Email intake parser: a parsed inbound mail plus its envelope recipient becomes one IntakeInput for the funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/email-intake.ts
 * Deps:    src/domain/application, src/domain/profile-url, src/domain/html-text
 * Tested:  src/domain/__tests__/email-intake.test.ts
 *
 * Key responsibilities:
 * - `splitRecipient`: "Jobs+Senior-BE@asajj.cz" -> { local: "jobs", tag: "senior-be" } (recipient gate + routing)
 * - `firstLinkedinUrl`, `pickCv`, `senderAllowed`: the per-mail decisions (specs/intake/email.md)
 * - `parseIntakeMail`: fields cut or dropped so IntakeInput.parse never throws on a real mail
 *
 * Design constraints:
 * - Pure: takes postal-mime's parsed shape (structural subset), no MIME parsing or I/O here
 * - Never decides status; the funnel (src/workflow/intake.ts) does
 * - Regexes stay linear in the body size (a mail reaches 10 MiB)
 */
import { IntakeInput, type CvFile } from "./application";
import { htmlToText } from "./html-text";
import { normalizeLinkedinProfile } from "./profile-url";

export type MailAttachment = { filename: string | null; mimeType: string; content: ArrayBuffer | Uint8Array | string };

/** The subset of postal-mime's `Email` this module reads; a parsed Email is assignable to it. */
export type ParsedMail = {
  messageId?: string | undefined;
  from?: { address?: string | undefined; name?: string | undefined } | undefined;
  subject?: string | undefined;
  text?: string | undefined;
  html?: string | undefined;
  attachments: readonly MailAttachment[];
};

const COVER_LETTER_MAX = 10_000;
const NOTE_MAX = 1000;
const NAME_MAX = 200;
const EXTERNAL_ID_MAX = 300;
const FILENAME_MAX = 200;
const CONTENT_TYPE_MAX = 100;
const TAG_MAX = 60;

/** Local part before "+" and the lowercased plus tag; accepts a bare address or "Name <addr>". */
export function splitRecipient(rcpt: string): { local: string; tag: string | null } {
  const address = (/<([^>]*)>/.exec(rcpt)?.[1] ?? rcpt).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  const localPart = at === -1 ? address : address.slice(0, at);
  const plus = localPart.indexOf("+");
  if (plus === -1) return { local: localPart, tag: null };
  const tag = localPart.slice(plus + 1);
  return { local: localPart.slice(0, plus), tag: tag === "" ? null : tag };
}

// Bounded repeats keep the scan linear on hostile bodies (a long "a.a.a." run would otherwise be quadratic).
const LINKEDIN_IN = /(?:https?:\/\/)?(?:[a-z0-9-]{1,63}\.){0,4}linkedin\.com\/in\/[^\s"'<>()[\]{}]{1,300}/gi;

/** First linkedin.com/in/<handle> in the text that normalises, trailing punctuation ignored. */
export function firstLinkedinUrl(text: string): string | null {
  for (const match of text.matchAll(LINKEDIN_IN)) {
    const url = normalizeLinkedinProfile(match[0].replace(/[.,;:!?]+$/, ""));
    if (url !== null) return url;
  }
  return null;
}

const isPdf = (a: MailAttachment): boolean =>
  a.mimeType.toLowerCase() === "application/pdf" || (a.filename?.toLowerCase().endsWith(".pdf") ?? false);
const isText = (a: MailAttachment): boolean => a.mimeType.toLowerCase() === "text/plain";

/** First PDF (by MIME type or .pdf name), else first text/plain attachment; everything else is ignored. */
export function pickCv(attachments: readonly MailAttachment[]): CvFile | null {
  const hit = attachments.find(isPdf) ?? attachments.find(isText);
  if (!hit) return null;
  const filename = hit.filename?.trim() ?? "";
  return {
    bytes: toArrayBuffer(hit.content),
    filename: (filename !== "" ? filename : isPdf(hit) ? "cv.pdf" : "cv.txt").slice(0, FILENAME_MAX),
    contentType: hit.mimeType.slice(0, CONTENT_TYPE_MAX),
  };
}

function toArrayBuffer(content: MailAttachment["content"]): ArrayBuffer {
  if (content instanceof ArrayBuffer) return content;
  const view = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

/** allowList: comma list of addresses or domains (a domain also covers its subdomains); blank = everyone. */
export function senderAllowed(from: string | undefined, allowList: string): boolean {
  const entries = allowList
    .split(",")
    .map((e) => e.trim().toLowerCase().replace(/^@/, ""))
    .filter((e) => e !== "");
  if (entries.length === 0) return true;
  const sender = from?.trim().toLowerCase() ?? "";
  const domain = sender.slice(sender.lastIndexOf("@") + 1);
  if (sender === "" || !sender.includes("@")) return false;
  return entries.some((e) => (e.includes("@") ? sender === e : domain === e || domain.endsWith(`.${e}`)));
}

/** rawFallbackId: sha256 hex of the raw message, used when Message-ID is missing or too long. */
export function parseIntakeMail(mail: ParsedMail, rcptTo: string, rawFallbackId: string): IntakeInput {
  const messageId = mail.messageId?.trim() ?? "";
  const text = mail.text?.trim() ?? "";
  const body = text !== "" ? text : htmlToText(mail.html ?? "");
  const name = mail.from?.name?.trim().slice(0, NAME_MAX) ?? "";
  const email = IntakeInput.shape.email.safeParse(mail.from?.address?.trim());
  const cv = pickCv(mail.attachments);
  const tag = splitRecipient(rcptTo).tag;
  const subject = mail.subject?.trim() ?? "";

  return {
    source: "email",
    externalId: messageId !== "" && messageId.length <= EXTERNAL_ID_MAX ? messageId : rawFallbackId,
    tag: tag === null ? undefined : tag.slice(0, TAG_MAX),
    name: name === "" ? undefined : name,
    email: email.success ? email.data : undefined,
    linkedinUrl: firstLinkedinUrl(`${mail.text ?? ""}\n${mail.html ?? ""}`) ?? undefined,
    cv: cv ?? undefined,
    coverLetter: body === "" ? undefined : body.slice(0, COVER_LETTER_MAX).trim(),
    note: subject === "" ? undefined : `subject: ${subject}`.slice(0, NOTE_MAX),
  };
}
