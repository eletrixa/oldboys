/**
 * Deterministic row ids: the same parts always give the same id, so a retried Workflow step upserts its rows
 * instead of duplicating them.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/stable-id.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/stable-id.test.ts
 *
 * Key responsibilities:
 * - stableId(...parts): 64-bit FNV-1a over the parts (NUL-separated), 16 lowercase hex chars
 *
 * Design constraints:
 * - Pure and synchronous (crypto.subtle is async); not a security hash, only an idempotency key
 */

const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export function stableId(...parts: readonly string[]): string {
  let h = OFFSET;
  for (const byte of new TextEncoder().encode(parts.join("\u0000"))) {
    h = ((h ^ BigInt(byte)) * PRIME) & MASK;
  }
  return h.toString(16).padStart(16, "0");
}
