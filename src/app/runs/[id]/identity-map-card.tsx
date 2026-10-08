/**
 * "Identity map" card above the profile list: which found profiles we link to the subject, at a glance.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/identity-map-card.tsx
 * Deps:    ./identity-map
 * Tested:  n/a (the layout is tested in __tests__/identity-map.test.ts)
 *
 * Key responsibilities:
 * - IdentityMapCard: SVG with the subject in the center, linked profiles on a ring (solid teal = this is them,
 *   dashed amber = not sure yet), namesakes in a grey "Someone else" column without a line; each node links out
 * - Decision mark inside every node (✓ ? ×) so colour is not the only carrier of meaning; HTML legend below
 *
 * Design constraints:
 * - No hooks, no next/link; decisions come from the same decisionOf as the profile list
 * - Never shows the match score or any rating of the person
 */
import type { Candidate, CandidateDecision } from "@/domain/claim";
import { CENTER_R, clip, COLUMN_HEADING_Y, edgeOf, identityMapLayout, labelLines, type MapNode, moreOf, NODE_R } from "./identity-map";

const TITLE_ID = "identity-map-title";
const DESC_ID = "identity-map-desc";

const MARK: Record<CandidateDecision, string> = { merge: "✓", "possibly-same-as": "?", rejected: "×" };

const NODE_CLS: Record<CandidateDecision, { circle: string; mark: string }> = {
  merge: { circle: "fill-teal-500/20 stroke-teal-400", mark: "fill-teal-300" },
  "possibly-same-as": { circle: "fill-amber-500/15 stroke-amber-400", mark: "fill-amber-300" },
  rejected: { circle: "fill-zinc-800 stroke-zinc-600", mark: "fill-zinc-400" },
};

function Node({ node, center }: { node: MapNode; center: { x: number; y: number } }): React.JSX.Element {
  const cls = NODE_CLS[node.decision];
  const body = (
    <>
      {node.tooltip !== "" && <title>{node.tooltip}</title>}
      <circle cx={node.x} cy={node.y} r={NODE_R} strokeWidth={2} className={cls.circle} />
      <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={600} className={cls.mark}>
        {MARK[node.decision]}
      </text>
      {labelLines(node, center).map((l) => (
        <text key={`${l.text}-${String(l.y)}`} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={11} className={l.muted ? "fill-zinc-500" : "fill-zinc-300"}>
          {l.text}
        </text>
      ))}
    </>
  );
  return node.href === null ? <g>{body}</g> : <a href={node.href} target="_blank" rel="noreferrer">{body}</a>;
}

export function IdentityMapCard({
  candidates,
  decisionOf,
  first,
}: {
  candidates: Candidate[];
  decisionOf: (c: Candidate) => CandidateDecision;
  first: string;
}): React.JSX.Element {
  const layout = identityMapLayout(candidates, decisionOf);
  const more = moreOf(layout);
  const { center } = layout;
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="font-semibold">Identity map</h2>
      <p className="mb-3 text-sm text-zinc-400">{layout.summary}</p>
      <svg viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`} className="h-auto w-full" role="img" aria-labelledby={`${TITLE_ID} ${DESC_ID}`}>
        <title id={TITLE_ID}>Identity map</title>
        <desc id={DESC_ID}>{layout.summary}</desc>
        {layout.linked.map((n) => {
          const e = edgeOf(center, n);
          return n.decision === "merge" ? (
            <line key={`edge-${n.id}`} {...e} strokeWidth={n.supplied ? 4 : 3} strokeLinecap="round" className="stroke-teal-400" />
          ) : (
            <line key={`edge-${n.id}`} {...e} strokeWidth={2} strokeDasharray="6 5" className="stroke-amber-400" />
          );
        })}
        <circle cx={center.x} cy={center.y} r={CENTER_R} strokeWidth={2} className="fill-teal-500/15 stroke-teal-400" />
        <text x={center.x} y={center.y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} className="fill-zinc-100">
          {clip(first, 10)}
        </text>
        {layout.linked.map((n) => (
          <Node key={n.id} node={n} center={center} />
        ))}
        {layout.hiddenLinked > 0 && (
          <text x={more.linked.x} y={more.linked.y} fontSize={11} className="fill-zinc-500">
            +{String(layout.hiddenLinked)} more
          </text>
        )}
        {layout.others.length > 0 && (
          <text x={more.others.x} y={COLUMN_HEADING_Y} fontSize={11} fontWeight={600} className="fill-zinc-400">
            Someone else
          </text>
        )}
        {layout.others.map((n) => (
          <Node key={n.id} node={n} center={center} />
        ))}
        {layout.hiddenOthers > 0 && (
          <text x={more.others.x} y={more.others.y} fontSize={11} className="fill-zinc-500">
            +{String(layout.hiddenOthers)} more
          </text>
        )}
      </svg>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block w-5 border-t-[3px] border-teal-400" />
          This is them
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-amber-400" />
          Not sure yet
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-3 rounded-full border border-zinc-600 bg-zinc-800" />
          Someone else, not linked
        </li>
      </ul>
      <p className="mt-2 text-xs text-zinc-500">Lines show which profiles we link to {first}, not how good a candidate is.</p>
    </section>
  );
}
