/**
 * Role seam: one LLM call turns a free-text role into 3-5 must-have questions; plus the pure `profileFor` classifier.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/seams/role.ts
 * Deps:    zod
 * Tested:  src/recipe/__tests__/role.test.ts
 *
 * Key responsibilities:
 * - `roleQuestions`: observable, web-searchable must-have questions with `mh-` ids; deterministic fallback on LLM failure;
 *   `calls` = successful model calls (0 when the model threw), so the header count stays true
 * - `profileFor`: ordered keyword rules mapping a role to an evidence profile
 *
 * Design constraints:
 * - Never emit ids that collide with the base hiring question ids; cap at 5; text under 160 chars, title under 48
 * - `profileFor` is pure and order-sensitive: first matching rule wins (credentialed, audience, makers, track-record)
 */
import { z } from "zod";
import type { Ports } from "@/domain/ports";
import type { Question } from "@/recipe/step";

const BASE_IDS = new Set(["current-role", "career-history", "public-code", "public-talks", "location-match", "contradictions"]);
const MAX_QUESTIONS = 5;
const MAX_TEXT = 160;
const MAX_TITLE = 48;

const MustHaves = z.array(z.object({ id: z.string(), text: z.string().min(1), title: z.string().optional(), accepted_evidence: z.array(z.string()) }));

export type RoleProfile = "makers" | "audience" | "credentialed" | "track-record" | "verify-only";

const RULES: readonly [Exclude<RoleProfile, "verify-only">, RegExp][] = [
  ["credentialed", /lawyer|attorney|doctor|physician|auditor|tax advis[eo]r|accountant|\bcpa\b|financial advis[eo]r|electrician|nurse/],
  ["audience", /social media|community|\bpr\b|influencer|creator|brand|marketing manager|content/],
  ["makers", /engineer|developer|\bdata\b|\bml\b|designer|writer|researcher|video|\b3d\b|architect/],
  ["track-record", /\bceo\b|founder|\bvp\b|director|head of|sales|business development|partnerships|account executive/],
];

export function profileFor(role: string): RoleProfile {
  const r = role.toLowerCase();
  return RULES.find(([, re]) => re.test(r))?.[0] ?? "verify-only";
}

function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fit(text: string, evidence: string[]): string {
  const full = evidence.length ? `${text} (${evidence.join(", ")})` : text;
  return full.length <= MAX_TEXT ? full : `${full.slice(0, MAX_TEXT - 1)}…`;
}

const WORK_MODE = /^(hybrid|remote|on-?site|office|full[- ]time|part[- ]time|contract|freelance)$/i;
const PLACE = /^\p{Lu}[\p{L} .'-]*$/u;

/**
 * The place a role is in: the last comma part after the title that looks like a place name, skipping work modes
 * ("Senior Data Engineer, Prague, hybrid" -> "Prague"); else the anchor when it is a plain city (not a URL or IČO).
 */
export function roleLocation(role: string, anchor = ""): string | null {
  const parts = role.split(",").slice(1).map((p) => p.trim());
  const place = parts.reverse().find((p) => !WORK_MODE.test(p) && PLACE.test(p));
  if (place !== undefined) return place;
  const a = anchor.trim();
  return PLACE.test(a) ? a : null;
}

/** Generic questions from the role title only; used when the LLM call fails. */
function fallback(role: string, anchor: string): Question[] {
  const title = (role.split(",")[0] ?? role).trim();
  const label = title === "" ? "this role" : title;
  const where = roleLocation(role, anchor);
  return [
    { id: "mh-title-experience", title: "Role experience", text: fit(`Has held a ${label} position or equivalent`, ["job history", "profile"]) },
    { id: "mh-public-work", title: "Public work", text: fit(`Has public work showing ${label} skills`, ["repo", "talk", "article", "portfolio"]) },
    { id: "mh-location-fit", title: "Location fit", text: fit(`Location compatible with ${where ?? "the role"}`, ["profile location"]) },
  ];
}

export async function roleQuestions(
  role: string,
  ports: Pick<Ports, "llm">,
  anchor = "",
): Promise<{ questions: Question[]; cost_usd: number; calls: number; notes: string[] }> {
  try {
    const r = await ports.llm({
      model: "primary",
      system:
        "Turn a hiring role into 3 to 5 must-have questions about a candidate. Each question must be observable: answerable from public web evidence (repos, talks, job history, profiles). `id` is kebab-case starting with \"mh-\". `title` is a 2 to 5 word label for the criterion, e.g. \"Marketing org leadership\". `accepted_evidence` lists short evidence types. No questions about health, religion, politics, ethnicity or sexuality.",
      prompt: `Role: ${role}`,
      schema: MustHaves,
    });
    const seen = new Set<string>();
    const questions: Question[] = [];
    for (const m of r.value) {
      const id = kebab(m.id);
      if (!id.startsWith("mh-") || BASE_IDS.has(id) || seen.has(id)) continue;
      seen.add(id);
      const title = m.title?.trim().slice(0, MAX_TITLE).trim();
      questions.push({ id, text: fit(m.text, m.accepted_evidence), ...(title !== undefined && title !== "" ? { title } : {}) });
      if (questions.length === MAX_QUESTIONS) break;
    }
    if (questions.length > 0) return { questions, cost_usd: r.cost_usd, calls: 1, notes: [] };
    return { questions: fallback(role, anchor), cost_usd: r.cost_usd, calls: 1, notes: ["role questions: no usable LLM output, used generic fallback"] };
  } catch (e) {
    const why = e instanceof Error ? e.message : "unknown error";
    return { questions: fallback(role, anchor), cost_usd: 0, calls: 0, notes: [`role questions: LLM failed (${why}), used generic fallback`] };
  }
}
