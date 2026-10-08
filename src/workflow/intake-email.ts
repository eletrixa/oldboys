/**
 * Worker email handler: Cloudflare Email Routing hands each inbound mail to jobs[+tag]@ here, and it goes to the funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/intake-email.ts
 * Deps:    postal-mime, src/domain (email-intake, digest, error-text), src/workflow/intake,
 *          vars INTAKE_FORWARD_TO + INTAKE_FROM_ALLOW (plus the funnel's bindings)
 * Tested:  src/workflow/__tests__/intake-email.test.ts
 *
 * Key responsibilities:
 * - Recipient gate: the zone's catch-all also lands here, so anything but jobs@ / jobs+<tag>@ is rejected
 * - Size gate (10 MiB), MIME parse, Message-ID (raw sha256 only when it is missing) as externalId, sender allow-list, ingestApplication
 * - Forward a human copy to INTAKE_FORWARD_TO; a forward failure is logged, never thrown
 *
 * Design constraints:
 * - Never writes applications itself (the funnel does) and never replies to the sender
 * - No Next.js imports (runs in the Worker `email` export)
 * - A funnel or parse error is logged and rethrown after the forward attempt (finally), so the human copy still arrives
 */
import PostalMime from "postal-mime";
import { sha256Hex } from "@/domain/digest";
import { parseIntakeMail, senderAllowed, splitRecipient } from "@/domain/email-intake";
import { errorText } from "@/domain/error-text";
import { ingestApplication, type IntakeEnv } from "./intake";

export type IntakeEmailEnv = IntakeEnv & { INTAKE_FORWARD_TO?: string; INTAKE_FROM_ALLOW?: string };

/** Cloudflare accepts 25 MiB; anything over this is refused before it is read. */
export const EMAIL_MAX_BYTES = 10 * 1024 * 1024;

const INTAKE_LOCAL_PART = "jobs";

export async function handleIntakeEmail(
  message: ForwardableEmailMessage,
  env: IntakeEmailEnv,
  now: Date,
  log: (line: string) => void,
): Promise<void> {
  if (splitRecipient(message.to).local !== INTAKE_LOCAL_PART) {
    message.setReject("no such address");
    return;
  }
  if (message.rawSize > EMAIL_MAX_BYTES) {
    message.setReject("message too large");
    return;
  }

  try {
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    const input = await parseIntakeMail(parsed, message.to, () => sha256Hex(raw));
    const allowed = senderAllowed(message.from, env.INTAKE_FROM_ALLOW ?? "");
    const result = await ingestApplication(input, env, now, { senderAllowed: allowed });
    log(`intake email ${result.applicationId} ${result.status}`);
  } catch (error) {
    log(`intake email failed: ${errorText(error)}`);
    throw error;
  } finally {
    const forwardTo = env.INTAKE_FORWARD_TO?.trim() ?? "";
    if (forwardTo !== "") {
      try {
        await message.forward(forwardTo);
      } catch (error) {
        log(`intake email forward failed: ${errorText(error)}`);
      }
    }
  }
}
