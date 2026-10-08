/**
 * GDPR Art. 15 data access export: what one run holds ABOUT THE CANDIDATE, as one machine-readable JSON.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/access-export.ts
 * Deps:    zod, src/domain/art9, src/domain/audit, src/domain/claim
 * Tested:  src/domain/__tests__/access-export.test.ts
 *
 * Key responsibilities:
 * - accessExport(rows, now): run head (subject, anchor, role, goal, controller), purpose, legal basis and deletion
 *   date (reused from src/domain/audit), confirmed sources with excerpts, linked profiles, claims, the brief text
 *   and a fixed "not included" list
 * - sources_about_you: identity "merged" only; a call transcript (actor in rows.call_actors) keeps no URL, because
 *   that URL carries the provider's conversation id
 * - claims: only when every supporting source is in sources_about_you (or there are none) and the claim is not
 *   tied to an unconfirmed candidate
 *
 * Design constraints:
 * - Pure: no I/O; rows come from D1 via the caller; JSON columns parse with Zod and never throw
 * - Never carries unverified sources, rejected or possibly-same-as candidates, brief.also_found, ledger rows,
 *   gaps, call rows (phone numbers, operators, consent notes) or account e-mails
 * - Art. 9: claims and brief lines matching containsArt9Topic are dropped silently (no count, no trace)
 * - Describes data, never rates the candidate
 */
import { z } from "zod";
import { containsArt9Topic } from "@/domain/art9";
import { deletionDate, LEGAL_BASIS, purpose, RETENTION_DAYS } from "@/domain/audit";
import { Brief } from "@/domain/claim";

export const ACCESS_EXPORT_FORMAT = "oldboys.access-export/1";
export const CALL_TRANSCRIPT_KIND = "phone call transcript";
export const NOT_INCLUDED: readonly string[] = [
  "Pages and profiles we could not confirm as yours: they may belong to other people with the same name, so they are not part of your data.",
  "Search snippets about other people found during the search.",
  "Internal run logs and costs: they describe the research process; see the audit record.",
  "Details of the hiring team's accounts and of verification call set-up (phone numbers, operators, consent notes).",
];

export type AccessExportRun = {
  id: string;
  subject: string;
  anchor: string;
  goal: string;
  role: string | null;
  created_at: string;
  /** Controller's name (LEFT JOIN organizations); null for bearer/extension runs. */
  organization_name: string | null;
};
export type AccessExportSourceRow = { id: string; url: string; actor: string; fetched_at: string; excerpt: string; identity: string };
export type AccessExportCandidateRow = { id: string; platform: string; profile_urls_json: string; snippet: string; decision: string };
export type AccessExportClaimRow = {
  id: string;
  candidate_id: string | null;
  kind: string;
  text: string;
  quote: string | null;
  confidence: number;
  supports_json: string;
};

export type AccessExportRows = {
  run: AccessExportRun;
  /** Recipe base questions + investigations.questions_json, for the brief's question text. */
  questions: readonly { id: string; text: string }[];
  sources: readonly AccessExportSourceRow[];
  candidates: readonly AccessExportCandidateRow[];
  /** In rank order. */
  claims: readonly AccessExportClaimRow[];
  brief_json: string | null;
  /** Source actors of verification call transcripts (CALL_SOURCE_ACTOR values). */
  call_actors: readonly string[];
};

export type AccessExportSource = {
  id: string;
  /** null for a phone call transcript (its URL names the provider's conversation). */
  url: string | null;
  kind: string;
  actor: string;
  fetched_at: string;
  excerpt: string;
};

export type AccessExport = {
  format: typeof ACCESS_EXPORT_FORMAT;
  generated_at: string;
  run: {
    id: string;
    subject: string;
    anchor: string;
    role: string | null;
    goal: string;
    created_at: string;
    organization: string | null;
  };
  purpose: string;
  legal_basis: string;
  retention: { days: number; delete_after: string };
  sources_about_you: AccessExportSource[];
  profiles_linked_to_you: { platform: string; url: string | null; snippet: string }[];
  claims: { id: string; kind: string; text: string; quote: string | null; confidence: number; source_ids: string[]; source_urls: string[] }[];
  brief: {
    headline: string | null;
    location_note: string | null;
    per_question: { question: string; summary: string }[];
    sections: { title: string; summary: string }[];
    interview_questions: string[];
    to_verify: string[];
    evidence: { url: string; excerpt: string }[];
  } | null;
  not_included: readonly string[];
};

const StringList = z.array(z.string());

function parsed<T>(schema: z.ZodType<T>, json: string | null): T | null {
  if (json === null || json === "") return null;
  try {
    const result = schema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** True when the text is safe to show: not empty and no GDPR Art. 9 topic. */
function shown(text: string): boolean {
  return text.trim() !== "" && !containsArt9Topic(text);
}

function briefPart(brief: Brief, questions: AccessExportRows["questions"], merged: ReadonlySet<string>): NonNullable<AccessExport["brief"]> {
  const questionText = new Map(questions.map((q) => [q.id, q.text]));
  return {
    headline: brief.headline !== null && shown(brief.headline) ? brief.headline : null,
    location_note: brief.location_note !== null && shown(brief.location_note) ? brief.location_note : null,
    per_question: brief.per_question
      .filter((q) => shown(q.summary))
      .map((q) => ({ question: questionText.get(q.question_id) ?? q.question_id, summary: q.summary })),
    sections: brief.sections.filter((s) => shown(s.summary)).map((s) => ({ title: s.title, summary: s.summary })),
    interview_questions: brief.interview_questions.filter(shown),
    to_verify: brief.to_verify.filter(shown),
    evidence: brief.evidence.filter((e) => merged.has(e.url)).map((e) => ({ url: e.url, excerpt: e.excerpt })),
  };
}

/** Builds the Art. 15 export of one run from its D1 rows; `now` is the generation time (ISO). */
export function accessExport(rows: AccessExportRows, now: string): AccessExport {
  const { run } = rows;
  const callActors = new Set(rows.call_actors);

  const sources: AccessExportSource[] = rows.sources
    .filter((s) => s.identity === "merged")
    .map((s) => {
      const call = callActors.has(s.actor);
      return { id: s.id, url: call ? null : s.url, kind: call ? CALL_TRANSCRIPT_KIND : "web page", actor: s.actor, fetched_at: s.fetched_at, excerpt: s.excerpt };
    });
  const byId = new Map(sources.map((s) => [s.id, s]));
  const publicUrls = new Set(sources.flatMap((s) => (s.url === null ? [] : [s.url])));

  const mergedCandidates = rows.candidates.filter((c) => c.decision === "merge");
  const mergedIds = new Set(mergedCandidates.map((c) => c.id));
  const profiles = mergedCandidates.map((c) => ({
    platform: c.platform,
    url: parsed(StringList, c.profile_urls_json)?.[0] ?? null,
    snippet: c.snippet,
  }));

  const claims = rows.claims.flatMap((c) => {
    const supports = parsed(StringList, c.supports_json);
    if (supports === null) return [];
    if (c.candidate_id !== null && !mergedIds.has(c.candidate_id)) return [];
    if (!supports.every((id) => byId.has(id))) return [];
    if (containsArt9Topic(c.text) || (c.quote !== null && containsArt9Topic(c.quote))) return [];
    const source_urls = supports.flatMap((id) => {
      const url = byId.get(id)?.url;
      return url === undefined || url === null ? [] : [url];
    });
    return [{ id: c.id, kind: c.kind, text: c.text, quote: c.quote, confidence: c.confidence, source_ids: supports, source_urls }];
  });

  const brief = parsed(Brief, rows.brief_json);

  return {
    format: ACCESS_EXPORT_FORMAT,
    generated_at: now,
    run: {
      id: run.id,
      subject: run.subject,
      anchor: run.anchor,
      role: run.role,
      goal: run.goal,
      created_at: run.created_at,
      organization: run.organization_name,
    },
    purpose: purpose(run),
    legal_basis: LEGAL_BASIS,
    retention: { days: RETENTION_DAYS, delete_after: deletionDate(run.created_at) },
    sources_about_you: sources,
    profiles_linked_to_you: profiles,
    claims,
    brief: brief === null ? null : briefPart(brief, rows.questions, publicUrls),
    not_included: NOT_INCLUDED,
  };
}
