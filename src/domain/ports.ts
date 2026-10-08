/**
 * Port types the recipe runner takes as parameters: actor call, LLM, ledger append, source store.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/ports.ts
 * Deps:    zod
 * Tested:  n/a (types only; exercised through runner tests with fake ports)
 *
 * Key responsibilities:
 * - Name the four seams between pure recipe logic and the outside world
 * - Name the two verification-call seams (plans/003): place a call, fetch its result
 *
 * Design constraints:
 * - Plain function types only; no interfaces with a single implementation, no DI container
 * - Real adapters (apify-client, @ai-sdk/anthropic, D1, R2) live outside src/domain and are passed in
 */
import type { z } from "zod";
import type { CallBrief, CallResult } from "@/domain/call";
import type { LedgerEntry, Source } from "@/domain/claim";

/** Run one Apify actor (or ARES fetch) with a hard timeout and cost cap; returns dataset items. */
export type ActorCall = (input: {
  actor: string;
  input: Record<string, unknown>;
  timeoutSecs: number;
  maxTotalChargeUsd: number;
}) => Promise<readonly unknown[]>;

/** One structured LLM call at a declared seam, validated against the given schema. */
export type LlmCall = <T>(input: {
  model: "primary" | "verify";
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<T>;

/** Append one ledger row; the store assigns seq and ts and returns the stored entry. */
export type LedgerAppend = (entry: Omit<LedgerEntry, "seq" | "ts">) => Promise<LedgerEntry>;

/** Persist a source's raw payload (R2) and its metadata row; returns the stored Source. */
export type SourceStore = (source: Omit<Source, "r2_key">, raw: unknown) => Promise<Source>;

/**
 * Place one outbound verification call. Called exactly once per approved call, from a request
 * handler (never from a retried Workflow step). A synchronous `result` is returned only by the
 * mock provider; the live provider delivers it later through the webhook or `FetchCallResult`.
 */
export type PlaceCall = (input: {
  callId: string;
  toNumber: string;
  brief: CallBrief;
}) => Promise<{ provider_conversation_id: string; result: CallResult | null }>;

/** Fetch a finished call result by provider conversation id; null while still in progress. */
export type FetchCallResult = (providerConversationId: string) => Promise<CallResult | null>;

/** The bag the runner receives. Tests pass fakes; the Workflow passes real adapters. */
export type Ports = {
  callActor: ActorCall;
  llm: LlmCall;
  appendLedger: LedgerAppend;
  storeSource: SourceStore;
};
