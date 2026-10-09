/**
 * Evidence on click (idea #5): pure helpers behind a claim's "Show evidence" panel: quote deep links, retrieval and
 * "kept until" dates, and the per-run source / quote-context lookups.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/evidence.ts
 * Deps:    src/domain/quote (QuoteContext type), src/domain/challenge (type), ./challenge (challengesById), ./state (RunState, isCvSource)
 * Tested:  src/app/runs/[id]/__tests__/evidence.test.ts
 *
 * Key responsibilities:
 * - quoteLink: the source URL with a Text Fragment (#:~:text=) so Chromium browsers open the page at the quote;
 *   long quotes use textStart,textEnd; other browsers simply open the page
 * - retrievedLabel / keptUntilLabel: deterministic UTC dates ("Retrieved 9 Oct 2026, 23:14 UTC")
 * - evidenceOf: RunState -> { sourceOf, contextOf, challengeOf } for SectionList / ClaimList
 *
 * Design constraints:
 * - Pure and server-safe; the pasted CV ("cv:") and non-http(s) URLs are never rewritten
 * - Dates in UTC with a fixed English month list, so server and client render the same text
 */
import type { Challenge } from "@/domain/challenge";
import type { QuoteContext } from "@/domain/quote";
import { challengesById } from "./challenge";
import { type RunState, isCvSource } from "./state";

/** What the report knows about one source: where it is, when we read it, until when our copy is kept, why it is theirs. */
export type SourceInfo = { url: string; fetched_at?: string | null; expires_at?: string | null; identity_reason?: string | null };

export type Evidence = {
  sourceOf: ReadonlyMap<string, SourceInfo>;
  /** Saved text around a claim's quote in one source; key = contextKey(claim id, source id). */
  contextOf: ReadonlyMap<string, QuoteContext>;
  /** Devil's advocate challenge per claim id (idea #8); empty for older runs. */
  challengeOf: ReadonlyMap<string, Challenge>;
};

export function contextKey(claimId: string, sourceId: string): string {
  return `${claimId}\u0000${sourceId}`;
}

export function evidenceOf(state: Pick<RunState, "sources" | "quote_contexts" | "challenges">): Evidence {
  return {
    challengeOf: challengesById(state),
    sourceOf: new Map(state.sources.map((s) => [s.id, s])),
    contextOf: new Map((state.quote_contexts ?? []).map(({ claim_id, source_id, before, match, after }) => [contextKey(claim_id, source_id), { before, match, after }])),
  };
}

/** Quotes up to this many words go in whole; longer ones as first and last FRAGMENT_WORDS words. */
const WHOLE_QUOTE_WORDS = 8;
const FRAGMENT_WORDS = 4;

/** encodeURIComponent plus the characters Text Fragments treat as syntax ("-", and the unreserved !'()*~). */
function encodeFragment(text: string): string {
  return encodeURIComponent(text).replace(/[-!'()*~]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function isHttp(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The source URL that opens scrolled to (and highlighting) the quote in Chromium browsers. Unchanged for the pasted
 * CV, non-http(s) URLs, and a missing or empty quote.
 */
export function quoteLink(url: string, quote: string | null): string {
  if (quote === null || isCvSource(url) || !isHttp(url)) return url;
  const words = quote
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’„«»…]+|[\s"'“”‘’„«»…]+$/g, "")
    .split(" ")
    .filter((w) => w !== "");
  if (words.length === 0) return url;
  const text =
    words.length <= WHOLE_QUOTE_WORDS
      ? encodeFragment(words.join(" "))
      : `${encodeFragment(words.slice(0, FRAGMENT_WORDS).join(" "))},${encodeFragment(words.slice(-FRAGMENT_WORDS).join(" "))}`;
  const hash = url.indexOf("#");
  if (hash === -1) return `${url}#:~:text=${text}`;
  return url.slice(hash).includes(":~:") ? `${url}&text=${text}` : `${url}:~:text=${text}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(iso: string | null | undefined): Date | null {
  if (typeof iso !== "string" || iso === "") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function day(d: Date): string {
  return `${String(d.getUTCDate())} ${MONTHS[d.getUTCMonth()] ?? ""} ${String(d.getUTCFullYear())}`;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** "Retrieved 9 Oct 2026, 23:14 UTC"; "Retrieval time not recorded" when missing or invalid. */
export function retrievedLabel(iso: string | null | undefined): string {
  const d = parse(iso);
  return d === null ? "Retrieval time not recorded" : `Retrieved ${day(d)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "16 Oct 2026" for the saved copy's purge date; null when missing or invalid. */
export function keptUntilLabel(iso: string | null | undefined): string | null {
  const d = parse(iso);
  return d === null ? null : day(d);
}
