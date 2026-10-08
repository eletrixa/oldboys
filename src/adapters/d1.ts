/**
 * D1 + R2 adapter: ledger append, source store, context load and outcome persistence for one run.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/adapters/d1.ts
 * Deps:    D1Database, R2Bucket (bindings), zod, src/domain/cv-check
 * Tested:  n/a (Workers bindings; exercised by `pnpm preview` runs)
 *
 * Key responsibilities:
 * - `loadContext` rebuilds StepContext from D1 before every step (Workflow steps are stateless); questions = recipe
 *   base + questions_json, plus `cv-consistency` once the run has a CV source (withCvQuestion), so extract, verify and
 *   synthesize see the CV question only on CV runs
 * - `persistOutcome` writes sources/candidates/claims/gaps/brief; claims_mode=replace rewrites the run's claims
 * - Raw payloads go to R2 under `<run>/<source>.json`; D1 keeps only the excerpt
 * - `applySourceIdentity` re-marks sources after the lineup (merged / unverified by profile key, then name + employer
 *   corroboration with identity_reason; subject from investigations, employer/headline from the seed_profile ledger rows)
 *
 * Design constraints:
 * - Column names mirror migrations 0001–0008; no ORM
 * - Source and claim writes are INSERT OR REPLACE so a retried Workflow step stays idempotent
 * - Gaps are also mirrored as ledger `decision` rows with `ref.gap = true` for the SSE stream
 */
import { Brief, Candidate, CandidateDecision, Claim, Gap, LedgerEntry, Source } from "@/domain/claim";
import type { LedgerAppend, SourceStore } from "@/domain/ports";
import { headlineOrgs } from "@/domain/corroborate";
import { withCvQuestion } from "@/domain/cv-check";
import { sourceIdentityUpdates } from "@/recipe/seams/resolve";
import type { StepContext, StepOutcome } from "@/recipe/sources/types";
import type { Question } from "@/recipe/step";

type Row = Record<string, unknown>;

const LEDGER_ATTEMPTS = 3;

function isSeqCollision(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE") || message.includes("PRIMARY KEY");
}

/** seq is assigned inside the INSERT; two Workflows may append to one run, so a (run_id, seq) collision is retried. */
export function makeLedgerAppend(db: D1Database): LedgerAppend {
  return async (entry) => {
    const ts = new Date().toISOString();
    const stmt = db
      .prepare(
        `INSERT INTO ledger_entries (run_id, seq, ts, step, kind, cost_usd, ms, ref_json)
         VALUES (?1, (SELECT COALESCE(MAX(seq), 0) + 1 FROM ledger_entries WHERE run_id = ?1), ?2, ?3, ?4, ?5, ?6, ?7)
         RETURNING seq`,
      )
      .bind(entry.run_id, ts, entry.step, entry.kind, entry.cost_usd, entry.ms, JSON.stringify(entry.ref ?? null));
    for (let attempt = 1; ; attempt++) {
      try {
        const row = await stmt.first<{ seq: number }>();
        if (!row) throw new Error("ledger insert returned no row");
        return LedgerEntry.parse({ ...entry, seq: row.seq, ts });
      } catch (error) {
        if (attempt >= LEDGER_ATTEMPTS || !isSeqCollision(error)) throw error;
      }
    }
  };
}

export function makeSourceStore(db: D1Database, bucket: R2Bucket): SourceStore {
  return async (source, raw) => {
    const r2_key = `${source.run_id}/${source.id}.json`;
    await bucket.put(r2_key, JSON.stringify(raw), { httpMetadata: { contentType: "application/json" } });
    const full = Source.parse({ ...source, r2_key });
    await db
      .prepare(
        `INSERT OR REPLACE INTO sources (id, run_id, url, actor, fetched_at, excerpt, r2_key, expires_at, identity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(full.id, full.run_id, full.url, full.actor, full.fetched_at, full.excerpt, full.r2_key, full.expires_at, full.identity)
      .run();
    return full;
  };
}

/** One claims row upsert; shared with VerificationCallWorkflow so a column change lands in one place. */
export function claimUpsert(db: D1Database, c: Claim): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR REPLACE INTO claims (id, run_id, question_id, candidate_id, text, kind, confidence, quote, supports_json, contradicts_json, rank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(c.id, c.run_id, c.question_id, c.candidate_id, c.text, c.kind, c.confidence, c.quote, JSON.stringify(c.supports), JSON.stringify(c.contradicts), c.rank);
}

function json<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string") return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export async function loadContext(db: D1Database, runId: string, baseQuestions: readonly Question[]): Promise<StepContext> {
  const inv = await db
    .prepare("SELECT subject, anchor, goal, role, questions_json, budget_usd, budget_calls FROM investigations WHERE id = ?")
    .bind(runId)
    .first<Row>();
  if (!inv) throw new Error(`investigation ${runId} not found`);
  const [cands, srcs, clms, gps, ledger] = await Promise.all([
    db.prepare("SELECT * FROM candidates WHERE run_id = ?").bind(runId).all<Row>(),
    db.prepare("SELECT * FROM sources WHERE run_id = ?").bind(runId).all<Row>(),
    db.prepare("SELECT * FROM claims WHERE run_id = ?").bind(runId).all<Row>(),
    db.prepare("SELECT * FROM gaps WHERE run_id = ?").bind(runId).all<Row>(),
    // Spent calls = paid actor runs a step recorded in ref.calls (free REST fetches and LLM calls are not counted); USD sums both.
    db.prepare("SELECT COALESCE(SUM(CASE WHEN kind = 'call' THEN COALESCE(json_extract(ref_json, '$.calls'), 1) ELSE 0 END), 0) AS calls, COALESCE(SUM(cost_usd), 0) AS usd FROM ledger_entries WHERE run_id = ? AND kind IN ('call','llm')").bind(runId).first<{ calls: number; usd: number }>(),
  ]);
  const extra = json<Question[]>(inv.questions_json, []);
  const sources = srcs.results.map((r) => Source.parse(r));
  return {
    runId,
    subject: String(inv.subject),
    anchor: String(inv.anchor),
    goal: inv.goal as StepContext["goal"],
    role: typeof inv.role === "string" ? inv.role : null,
    questions: withCvQuestion(String(inv.goal), [...baseQuestions, ...extra], sources),
    candidates: cands.results.map((r) =>
      Candidate.parse({ ...r, profile_urls: json(r.profile_urls_json, []), reasons: json(r.reasons_json, []) }),
    ),
    sources,
    claims: clms.results.map((r) =>
      Claim.parse({ ...r, supports: json(r.supports_json, []), contradicts: json(r.contradicts_json, []) }),
    ),
    gaps: gps.results.map((r) => Gap.parse(r)),
    budget: { usd: Number(inv.budget_usd), calls: Number(inv.budget_calls) },
    spent: { usd: ledger?.usd ?? 0, calls: ledger?.calls ?? 0 },
  };
}

export async function persistOutcome(db: D1Database, runId: string, out: StepOutcome): Promise<void> {
  const stmts: D1PreparedStatement[] = [];
  for (const c of out.candidates) {
    stmts.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO candidates (id, run_id, name, profile_urls_json, anchor_match, score, decision, platform, handle, snippet, reasons_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(c.id, c.run_id, c.name, JSON.stringify(c.profile_urls), c.anchor_match, c.score, c.decision, c.platform, c.handle, c.snippet, JSON.stringify(c.reasons)),
    );
  }
  if (out.claims_mode === "replace") stmts.push(db.prepare("DELETE FROM claims WHERE run_id = ?").bind(runId));
  for (const c of out.claims) stmts.push(claimUpsert(db, c));
  for (const g of out.gaps) {
    stmts.push(db.prepare("INSERT OR REPLACE INTO gaps (run_id, question_id, reason) VALUES (?, ?, ?)").bind(g.run_id, g.question_id, g.reason));
  }
  if (out.brief) {
    stmts.push(
      db
        .prepare("INSERT OR REPLACE INTO briefs (run_id, brief_json, created_at) VALUES (?, ?, ?)")
        .bind(runId, JSON.stringify(Brief.parse(out.brief)), new Date().toISOString()),
    );
  }
  if (stmts.length > 0) await db.batch(stmts);
}

export async function setCandidateDecisions(db: D1Database, runId: string, decisions: readonly { id: string; decision: Candidate["decision"] }[]): Promise<void> {
  if (decisions.length === 0) return;
  await db.batch(
    decisions.map((d) => db.prepare("UPDATE candidates SET decision = ? WHERE id = ? AND run_id = ?").bind(d.decision, d.id, runId)),
  );
  await applySourceIdentity(db, runId);
}

/** Organisations the seed_profile ledger rows recorded: the employer plus orgs named in the headline ("ex-Meta"). */
export function seedOrgs(refs: readonly (string | null)[]): string[] {
  return refs.flatMap((raw) => {
    const ref = json<Row | null>(raw, null);
    if (ref === null) return [];
    const employer = typeof ref.employer === "string" ? [ref.employer] : [];
    return [...employer, ...(typeof ref.headline === "string" ? headlineOrgs(ref.headline) : [])];
  });
}

/**
 * Sources on a merged candidate's profile become "merged", on a rejected one "unverified"; then still-unverified
 * sources naming the subject in full with a confirmed employer token become "merged" with identity_reason
 * (rule in resolve.ts). Idempotent.
 */
export async function applySourceIdentity(db: D1Database, runId: string): Promise<number> {
  const [cands, srcs, head, seed] = await Promise.all([
    db.prepare("SELECT decision, profile_urls_json FROM candidates WHERE run_id = ?").bind(runId).all<Row>(),
    db.prepare("SELECT id, url, identity, excerpt, actor FROM sources WHERE run_id = ?").bind(runId).all<Row>(),
    db.prepare("SELECT subject FROM investigations WHERE id = ?").bind(runId).first<{ subject: string }>(),
    db.prepare("SELECT ref_json FROM ledger_entries WHERE run_id = ? AND step = 'seed_profile'").bind(runId).all<{ ref_json: string | null }>(),
  ]);
  const updates = sourceIdentityUpdates(
    cands.results.map((r) => ({ decision: CandidateDecision.parse(r.decision), profile_urls: json<string[]>(r.profile_urls_json, []) })),
    srcs.results.map((r) => ({
      id: String(r.id),
      url: String(r.url),
      identity: r.identity === "merged" ? ("merged" as const) : ("unverified" as const),
      excerpt: typeof r.excerpt === "string" ? r.excerpt : "",
      actor: typeof r.actor === "string" ? r.actor : "",
    })),
    { subject: head?.subject ?? "", orgs: seedOrgs(seed.results.map((r) => r.ref_json)) },
  );
  if (updates.length > 0) {
    await db.batch(
      updates.map((u) => db.prepare("UPDATE sources SET identity = ?, identity_reason = ? WHERE id = ? AND run_id = ?").bind(u.identity, u.reason, u.id, runId)),
    );
  }
  return updates.length;
}
