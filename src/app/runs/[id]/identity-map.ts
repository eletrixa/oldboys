/**
 * Identity map layout: where each found profile sits around the subject, computed from the lineup without React.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/identity-map.ts
 * Deps:    src/domain/claim (Candidate types), ./state (sortLineup, PLATFORM_LABEL)
 * Tested:  src/app/runs/[id]/__tests__/identity-map.test.ts
 *
 * Key responsibilities:
 * - identityMapLayout: linked profiles (merge, possibly-same-as) on a ring around the subject, starting on top;
 *   namesakes (rejected) in a separate column, not connected; caps with hidden counts; a one-line summary
 * - labelLines / edgeOf / moreOf: label text positions and center-to-node lines, shared by the card and the tests
 * - Node text: platform label (hostname for web hits), @handle (dropped on a dense ring), tooltip = snippet · first reason; href only http(s)
 *
 * Design constraints:
 * - Pure and deterministic; uses the same decisionOf as the profile list, so lineup answers move nodes live
 * - Shows the identity decision only, never the match score or any rating of the person
 * - Every circle and label stays inside the viewBox (labels estimated at LABEL_CHAR_W px per character)
 */
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { PLATFORM_LABEL, sortLineup } from "./state";

export type MapNode = {
  id: string;
  x: number;
  y: number;
  decision: CandidateDecision;
  label: string;
  handle: string | null;
  href: string | null;
  tooltip: string;
  supplied: boolean;
};

export type MapLayout = {
  width: number;
  height: number;
  center: { x: number; y: number };
  /** Ring radius: RING_R, or RING_R_DENSE when more than DENSE_AFTER linked nodes are drawn. */
  ring: number;
  linked: MapNode[];
  others: MapNode[];
  hiddenLinked: number;
  hiddenOthers: number;
  summary: string;
};

export type LabelLine = { x: number; y: number; anchor: "start" | "middle"; text: string; muted: boolean };

export const MAP_WIDTH = 600;
export const NODE_R = 20;
export const CENTER_R = 34;
export const RING_R = 112;
export const RING_R_DENSE = 136;
/** Above this many ring nodes the ring grows and drops the @handle line (the node still links to the profile). */
export const DENSE_AFTER = 6;
/** Estimated label width per character at font size 11, used to keep labels inside the viewBox. */
export const LABEL_CHAR_W = 6.5;
export const MAX_LINKED = 10;
export const MAX_OTHERS = 6;
const MAX_LABEL = 16;
const MAX_TOOLTIP = 140;
const CENTER_X = 200;
/** Room above the top ring node for its two label lines. */
const ABOVE_RING = 60;
const COLUMN_X = 450;
const COLUMN_TOP = 64;
const COLUMN_STEP = 48;
/** Baseline of the "Someone else" heading above the column. */
export const COLUMN_HEADING_Y = 30;
const MARGIN = 8;

/** Cuts to `max` characters including the trailing "…". */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function safeHref(url: string | undefined): string | null {
  if (url === undefined) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function toNode(c: Candidate, decision: CandidateDecision, x: number, y: number): MapNode {
  const reason = c.reasons[0]?.replace(/^fallback:\s*/i, "") ?? "";
  const tooltip = [c.snippet.trim(), reason.trim()].filter((s) => s !== "").join(" · ");
  const handle = c.platform !== "web" && c.handle !== null && c.handle !== "" ? clip(`@${c.handle.replace(/^@/, "")}`, MAX_LABEL) : null;
  return {
    id: c.id,
    x,
    y,
    decision,
    label: clip(PLATFORM_LABEL[c.platform] ?? host(c.profile_urls[0] ?? "web"), MAX_LABEL),
    handle,
    href: safeHref(c.profile_urls[0]),
    tooltip: clip(tooltip, MAX_TOOLTIP),
    supplied: /you supplied/i.test(c.reasons[0] ?? ""),
  };
}

/** "2 profiles are theirs · 1 not sure yet · 3 someone else"; zero parts left out. */
function summaryOf(merged: number, unsure: number, rejected: number): string {
  const parts = [
    merged > 0 ? `${String(merged)} ${merged === 1 ? "profile is" : "profiles are"} theirs` : "",
    unsure > 0 ? `${String(unsure)} not sure yet` : "",
    rejected > 0 ? `${String(rejected)} someone else` : "",
  ].filter((p) => p !== "");
  return parts.length === 0 ? "No profiles found yet" : parts.join(" · ");
}

/**
 * Label lines to the right of a column node (rejected); for a ring node above it in the upper half and under it in
 * the lower half, so the line to the center never crosses the node's own label.
 */
export function labelLines(node: MapNode, center: { x: number; y: number }): LabelLine[] {
  const texts = [node.label, node.handle].filter((t): t is string => t !== null);
  if (node.decision === "rejected") {
    const x = node.x + NODE_R + 8;
    const top = texts.length === 1 ? node.y + 4 : node.y - 2;
    return texts.map((text, i) => ({ x, y: top + i * 13, anchor: "start", text, muted: i > 0 }));
  }
  const top = node.y < center.y - 1 ? node.y - NODE_R - 6 - (texts.length - 1) * 13 : node.y + NODE_R + 14;
  return texts.map((text, i) => ({ x: node.x, y: top + i * 13, anchor: "middle", text, muted: i > 0 }));
}

/** Line from the center circle's edge to the node circle's edge. */
export function edgeOf(center: { x: number; y: number }, node: MapNode): { x1: number; y1: number; x2: number; y2: number } {
  const dx = node.x - center.x;
  const dy = node.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return { x1: center.x + ux * CENTER_R, y1: center.y + uy * CENTER_R, x2: node.x - ux * NODE_R, y2: node.y - uy * NODE_R };
}

/** Start of the "+N more" line under the column, and in the bottom-left corner for the ring (clear of every line). */
export function moreOf(layout: MapLayout): { linked: { x: number; y: number }; others: { x: number; y: number } } {
  const last = layout.others[layout.others.length - 1];
  return {
    linked: { x: MARGIN + 4, y: layout.height - MARGIN - 4 },
    others: { x: COLUMN_X - NODE_R, y: (last?.y ?? COLUMN_TOP) + NODE_R + 18 },
  };
}

export function identityMapLayout(candidates: readonly Candidate[], decisionOf: (c: Candidate) => CandidateDecision): MapLayout {
  const sorted = sortLineup(candidates, decisionOf);
  const linkedAll = sorted.filter((c) => decisionOf(c) !== "rejected");
  const othersAll = sorted.filter((c) => decisionOf(c) === "rejected");
  const shown = linkedAll.slice(0, MAX_LINKED);
  const dense = shown.length > DENSE_AFTER;
  const ring = dense ? RING_R_DENSE : RING_R;
  const center = { x: CENTER_X, y: ring + ABOVE_RING };

  const linked = shown.map((c, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / shown.length;
    const x = Math.round((center.x + ring * Math.cos(angle)) * 100) / 100;
    const y = Math.round((center.y + ring * Math.sin(angle)) * 100) / 100;
    const node = toNode(c, decisionOf(c), x, y);
    return dense ? { ...node, handle: null } : node;
  });
  const others = othersAll.slice(0, MAX_OTHERS).map((c, i) => toNode(c, "rejected", COLUMN_X, COLUMN_TOP + i * COLUMN_STEP));
  const hiddenOthers = othersAll.length - others.length;

  // Bottom ring node plus its label lines, the column, and the "+N more" line under the column.
  const ringBottom = center.y + ring + NODE_R + (dense ? 14 : 27) + 3;
  const lastOther = others[others.length - 1];
  const columnBottom = lastOther === undefined ? 0 : lastOther.y + NODE_R + (hiddenOthers > 0 ? 18 + 3 : 0);
  const merged = linkedAll.filter((c) => decisionOf(c) === "merge").length;

  return {
    width: MAP_WIDTH,
    height: Math.max(ringBottom, columnBottom) + MARGIN,
    center,
    ring,
    linked,
    others,
    hiddenLinked: linkedAll.length - linked.length,
    hiddenOthers,
    summary: summaryOf(merged, linkedAll.length - merged, othersAll.length),
  };
}
