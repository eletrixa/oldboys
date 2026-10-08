/**
 * Pure validation helpers for the hosted apply form, used by the client form and by POST /api/apply.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/apply-fields.ts
 * Deps:    zod, src/domain (application limits, cv-text isPdf, profile-url)
 * Tested:  src/app/apply/[tag]/__tests__/apply-fields.test.ts
 *
 * Key responsibilities:
 * - The candidate-facing error texts in one place; limits are the domain's (CV 10 MiB, name, email, LinkedIn URL, message)
 * - `checkApply`: first problem in a draft as a humane sentence, or null; the server runs the same check,
 *   the email is validated once here with z.email()
 *
 * Design constraints:
 * - Pure: no DOM; the client bundle takes zod and the domain constants, nothing else
 * - Convenience on the client, authority on the server: never trust a client pass
 */
import { z } from "zod";
import { COVER_LETTER_MAX, CV_MAX_BYTES, EMAIL_MAX, LINKEDIN_MAX, NAME_MAX } from "@/domain/application";
import { isPdf } from "@/domain/cv-text";
import { normalizeLinkedinProfile } from "@/domain/profile-url";

export const MESSAGE_MAX = COVER_LETTER_MAX;

const Email = z.email().max(EMAIL_MAX);

export const MESSAGES = {
  name: "Please enter your full name.",
  email: "Please enter a valid email address.",
  linkedin: "That does not look like a LinkedIn profile link. It should look like linkedin.com/in/your-name.",
  linkedinOrCv: "Please add your LinkedIn profile or attach your CV.",
  cvType: "Please attach your CV as a PDF.",
  cvSize: "Your CV is larger than 10 MB. Please attach a smaller PDF.",
  message: "Your message is too long. Please shorten it.",
} as const;

export type ApplyDraft = {
  name: string;
  email: string;
  linkedinUrl: string;
  cv: File | null;
  message: string;
};

/** The first problem with the draft as a sentence for the candidate, or null when it can be sent. */
export function checkApply(draft: ApplyDraft): string | null {
  const name = draft.name.trim();
  const email = draft.email.trim();
  const linkedinUrl = draft.linkedinUrl.trim();

  if (name === "" || name.length > NAME_MAX) return MESSAGES.name;
  if (!Email.safeParse(email).success) return MESSAGES.email;
  if (linkedinUrl !== "" && (linkedinUrl.length > LINKEDIN_MAX || normalizeLinkedinProfile(linkedinUrl) === null)) {
    return MESSAGES.linkedin;
  }
  if (draft.cv !== null) {
    if (!isPdf({ filename: draft.cv.name, contentType: draft.cv.type })) return MESSAGES.cvType;
    if (draft.cv.size > CV_MAX_BYTES) return MESSAGES.cvSize;
  }
  if (linkedinUrl === "" && draft.cv === null) return MESSAGES.linkedinOrCv;
  if (draft.message.length > MESSAGE_MAX) return MESSAGES.message;
  return null;
}
