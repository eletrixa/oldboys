/**
 * Worker email handler: Cloudflare Email Routing hands each inbound mail to jobs[+tag]@ here, and it goes to the funnel.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/workflow/intake-email.ts
 * Deps:    postal-mime, WebCrypto, src/domain/email-intake, src/workflow/intake,
 *          vars INTAKE_FORWARD_TO + INTAKE_FROM_ALLOW (plus the funnel's bindings)
 * Tested:  src/workflow/__tests__/intake-email.test.ts
 *
 * Key responsibilities:
 * - Recipient gate: the zone's catch-all also lands here, so anything but jobs@ / jobs+<tag>@ is rejected
 * - Size gate (10 MiB), MIME parse, Message-ID or raw sha256 as externalId, sender allow-list, ingestApplication
 * - Forward a human copy to INTAKE_FORWARD_TO; a forward failure is logged, never thrown
 *
 * Design constraints:
 * - Never writes applications itself (the funnel does) and never replies to the sender
 * - No Next.js imports (runs in the Worker `email` export)
 * - A funnel or parse error is logged and rethrown only after the forward attempt, so the human copy still arrives
 */
import PostalMime from "postal-mime";
import { parseIntakeMail, senderAllowed, splitRecipient } from "@/domain/email-intake";
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

  let failure: { error: unknown } | null = null;
  try {
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    const input = parseIntakeMail(parsed, message.to, await sha256hex(raw));
    const allowed = senderAllowed(message.from, env.INTAKE_FROM_ALLOW ?? "");
    const result = await ingestApplication(input, env, now, { senderAllowed: allowed });
    log(`intake email ${result.applicationId} ${result.status}`);
  } catch (error) {
    failure = { error };
    log(`intake email failed: ${errorText(error)}`);
  }

  const forwardTo = env.INTAKE_FORWARD_TO?.trim() ?? "";
  if (forwardTo !== "") {
    try {
      await message.forward(forwardTo);
    } catch (error) {
      log(`intake email forward failed: ${errorText(error)}`);
    }
  }

  if (failure !== null) throw failure.error;
}

async function sha256hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

function errorText(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}
