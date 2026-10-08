/**
 * Constant-time string comparison for secrets: bearer tokens and webhook signatures.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/timing-safe-equal.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/elevenlabs-signature.test.ts (via verifyElevenLabsSignature)
 *
 * Key responsibilities:
 * - Compare two strings without an early exit that leaks the first differing position
 *
 * Design constraints:
 * - Length mismatch returns false immediately (length is not secret for tokens or hex digests)
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
