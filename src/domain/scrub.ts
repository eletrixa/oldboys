/**
 * Reason scrub: strips personal data from free-text reasons (gap, skip and failure texts) before they are shown or stored.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/scrub.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/scrub.test.ts
 *
 * Key responsibilities:
 * - scrubReason: http(s) URL → hostname only ("(link)" when it does not parse), e-mail → "(email)",
 *   phone-like number (9+ digits) → "(number)", whitespace collapsed, capped at 160 characters with "…"
 *
 * Design constraints:
 * - Pure: no I/O; never throws
 * - Plain recipe reasons ("run budget reached", "no public GitHub profile found") pass unchanged;
 *   dates, HTTP status codes and small counts stay
 */

const MAX_LENGTH = 160;
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
/** Punctuation that ends a sentence rather than the URL ("…/x: HTTP 429", "see https://a.cz.") */
const URL_TAIL_RE = /[.,;:!?)\]}]+$/;
const EMAIL_RE = /(?:mailto:)?[\w.%+-]+@[a-z\d.-]+\.[a-z]{2,}/gi;
/** Digit groups joined by spaces, dashes, dots or parentheses, optional leading "+"; counted below. */
const PHONE_RE = /(?<![\w+(])\(?\+?\d(?:[ .()-]{1,2}\d|\d)*(?!\w)/g;
const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const MIN_PHONE_DIGITS = 9;

function hostOf(url: string): string {
  const tail = URL_TAIL_RE.exec(url)?.[0] ?? "";
  const bare = url.slice(0, url.length - tail.length);
  try {
    const { hostname } = new URL(bare);
    return `${hostname === "" ? "(link)" : hostname}${tail}`;
  } catch {
    return `(link)${tail}`;
  }
}

function phone(match: string): string {
  const digits = match.replace(/\D/g, "").length;
  return digits >= MIN_PHONE_DIGITS && !DATE_RE.test(match) ? "(number)" : match;
}

/** A reason safe to keep in a record or send to the candidate: no URLs with queries, e-mails or phone numbers. */
export function scrubReason(text: string): string {
  const clean = text
    .replace(/\s+/g, " ")
    .replace(URL_RE, hostOf)
    .replace(EMAIL_RE, "(email)")
    .replace(PHONE_RE, phone)
    .trim();
  return clean.length > MAX_LENGTH ? `${clean.slice(0, MAX_LENGTH - 1).trimEnd()}…` : clean;
}
