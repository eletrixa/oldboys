/**
 * Pure validation helpers for the hosted apply form, used by the client form and by POST /api/apply.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/apply-fields.ts
 * Deps:    src/domain/profile-url
 * Tested:  src/app/apply/[tag]/__tests__/apply-fields.test.ts
 *
 * Key responsibilities:
 * - Limits (CV 5 MiB, name, email, LinkedIn URL, message) and the candidate-facing error texts in one place
 * - `checkApply`: first problem in a draft as a humane sentence, or null; the server runs the same check
 * - `isPdf`: media type application/pdf or a .pdf file name
 *
 * Design constraints:
 * - Pure and small: no zod and no DOM, so the client bundle stays light; the server adds z.email on top
 * - Convenience on the client, authority on the server: never trust a client pass
 */
import { normalizeLinkedinProfile } from "@/domain/profile-url";

export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const NAME_MAX = 200;
export const EMAIL_MAX = 200;
export const LINKEDIN_MAX = 500;
export const MESSAGE_MAX = 10_000;

export const MESSAGES = {
  name: "Please enter your full name.",
  email: "Please enter a valid email address.",
  linkedin: "That does not look like a LinkedIn profile link. It should look like linkedin.com/in/your-name.",
  linkedinOrCv: "Please add your LinkedIn profile or attach your CV.",
  cvType: "Please attach your CV as a PDF.",
  cvSize: "Your CV is larger than 5 MB. Please attach a smaller PDF.",
  message: "Your message is too long. Please shorten it.",
} as const;

export type ApplyDraft = {
  name: string;
  email: string;
  linkedinUrl: string;
  cv: File | null;
  message: string;
};

export function isPdf(file: { name: string; type: string }): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** The first problem with the draft as a sentence for the candidate, or null when it can be sent. */
export function checkApply(draft: ApplyDraft): string | null {
  const name = draft.name.trim();
  const email = draft.email.trim();
  const linkedinUrl = draft.linkedinUrl.trim();

  if (name === "" || name.length > NAME_MAX) return MESSAGES.name;
  if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return MESSAGES.email;
  if (linkedinUrl !== "" && (linkedinUrl.length > LINKEDIN_MAX || normalizeLinkedinProfile(linkedinUrl) === null)) {
    return MESSAGES.linkedin;
  }
  if (draft.cv !== null) {
    if (!isPdf(draft.cv)) return MESSAGES.cvType;
    if (draft.cv.size > CV_MAX_BYTES) return MESSAGES.cvSize;
  }
  if (linkedinUrl === "" && draft.cv === null) return MESSAGES.linkedinOrCv;
  if (draft.message.length > MESSAGE_MAX) return MESSAGES.message;
  return null;
}
