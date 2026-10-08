/**
 * Messages between the content script / popup and the background.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/src/messages.ts
 * Deps:    zod
 * Tested:  n/a (types + schema only)
 *
 * Key responsibilities:
 * - One discriminated union, validated on receipt in the background
 *
 * Design constraints:
 * - Keep payloads to plain JSON
 */
import { z } from "zod";
import { Mark } from "./lib/mark";

export const Message = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), mark: Mark }),
  z.object({ type: z.literal("poll") }),
  z.object({ type: z.literal("open"), runId: z.string().min(1) }),
  z.object({ type: z.literal("forget"), runId: z.string().min(1) }),
]);
export type Message = z.infer<typeof Message>;

export type Reply = { ok: true } | { ok: false; error: string };
