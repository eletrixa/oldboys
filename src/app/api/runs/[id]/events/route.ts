/**
 * GET /api/runs/:id/events: Server-Sent Events stream of ledger entries, polled from D1 every second.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/runs/[id]/events/route.ts
 * Deps:    @opennextjs/cloudflare (getCloudflareContext), binding DB
 * Tested:  n/a
 *
 * Key responsibilities:
 * - Replay the whole ledger on connect (or from Last-Event-ID), then tail `seq > last`
 * - Close when the investigation reaches a terminal status, the client cancels, or MAX_STREAM_MS elapses
 *
 * Design constraints:
 * - No runtime = "edge"; events are idempotent by seq (SSE id) so reconnects are safe
 * - 1 s poll interval is the accepted latency (plans/002 risk C)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type LedgerRow = {
  seq: number;
  ts: string;
  step: string;
  kind: string;
  cost_usd: number;
  ms: number;
  ref_json: string | null;
};

const POLL_MS = 1000;
/** Upper bound on one SSE connection; matches the Workflow's 1 hour lineup timeout. */
const MAX_STREAM_MS = 60 * 60 * 1000;
const TERMINAL = new Set(["done", "failed"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const { env } = getCloudflareContext();

  const exists = await env.DB.prepare("SELECT 1 AS one FROM investigations WHERE id = ?")
    .bind(id)
    .first();
  if (!exists) return Response.json({ error: "run not found" }, { status: 404 });

  const lastHeader = Number(request.headers.get("Last-Event-ID") ?? "0");
  let last = Number.isFinite(lastHeader) ? lastHeader : 0;
  const encoder = new TextEncoder();

  let closed = false;
  const deadline = Date.now() + MAX_STREAM_MS;

  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      closed = true;
    },
    async start(controller) {
      const send = (eventName: string, eventId: number | null, data: unknown) => {
        const idLine = eventId === null ? "" : `id: ${eventId}\n`;
        controller.enqueue(
          encoder.encode(`${idLine}event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      while (!closed && !request.signal.aborted && Date.now() < deadline) {
        const { results } = await env.DB.prepare(
          `SELECT seq, ts, step, kind, cost_usd, ms, ref_json
           FROM ledger_entries WHERE run_id = ? AND seq > ? ORDER BY seq ASC`,
        )
          .bind(id, last)
          .all<LedgerRow>();

        for (const row of results) {
          send("ledger", row.seq, {
            run_id: id,
            seq: row.seq,
            ts: row.ts,
            step: row.step,
            kind: row.kind,
            cost_usd: row.cost_usd,
            ms: row.ms,
            ref: row.ref_json === null ? null : (JSON.parse(row.ref_json) as unknown),
          });
          last = row.seq;
        }

        const status = await env.DB.prepare("SELECT status FROM investigations WHERE id = ?")
          .bind(id)
          .first<{ status: string }>();
        if (status && TERMINAL.has(status.status) && results.length === 0) {
          send("status", null, { run_id: id, status: status.status });
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
