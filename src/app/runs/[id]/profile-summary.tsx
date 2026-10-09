/**
 * Verdict strip at the top of the candidate profile: fit, risks, questions, fact and inference counts, current role, legend, section anchors.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-summary.tsx
 * Deps:    react, src/domain/claim (types), ../../ui, ./profile-evidence, ./profile-fit
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Fit with neutral bar and must-haves evidenced, risks, questions, FACT / INFERENCE and source counts
 * - FACT / INFERENCE legend and anchors to the sections that exist
 */
import type { PositionFit, Profile, ProfileEvidence } from "@/domain/claim";
import { CARD, Eyebrow } from "../../ui";
import { type Ctx, FIGURE, NOTE, plural } from "./profile-evidence";
import { Bar, evidenced, fitPct } from "./profile-fit";

const SECTIONS = [
  ["achievements", "Achievements"],
  ["risks", "Risks"],
  ["history", "History"],
  ["working-style", "Working style"],
  ["fit", "Position fit"],
  ["ask", "What to ask"],
] as const;

/** Verdict strip the recruiter reads first: fit with bar, risks, questions, evidence; then current role, legend, anchors. */
export function SummaryBox({ profile, fits, all, ctx, present }: { profile: Profile; fits: PositionFit[]; all: ProfileEvidence[]; ctx: Ctx; present: ReadonlySet<string> }): React.JSX.Element {
  const job = profile.history.find((h) => h.kind === "job");
  const [fit] = fits;
  const facts = all.filter((e) => e.kind === "FACT").length;
  const cells: { label: string; value: string; sub: string; bar?: number }[] = [
    ...(fit === undefined ? [] : [{ label: `Fit, ${fit.role}`, value: `${String(fitPct(fit))}%`, sub: evidenced(fit), bar: fitPct(fit) }]),
    { label: "Risks", value: String(profile.risks.length), sub: "to check before an offer" },
    { label: "Questions", value: String(profile.questions.length), sub: "each closes a risk or gap" },
    { label: "Facts · inferences", value: `${String(facts)} · ${String(all.length - facts)}`, sub: `from ${plural(ctx.cite.size, "source")}` },
  ];
  return (
    <section className={CARD}>
      <Eyebrow>Profile at a glance</Eyebrow>
      <dl className="pf-verdict mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        {cells.map(({ label, value, sub, bar }) => (
          <div key={label} className="min-w-0">
            <dt className={NOTE}>{label}</dt>
            <dd className={`mt-1 ${FIGURE}`}>{value}</dd>
            <dd className={`mt-1 ${NOTE}`}>{sub}</dd>
            {bar !== undefined && (
              <dd className="mt-2">
                <Bar pct={bar} />
              </dd>
            )}
          </div>
        ))}
      </dl>
      {job !== undefined && (
        <p className="mt-4 text-sm text-ink">
          <span className="text-muted">Current role </span>
          {`${job.title}, ${job.organization}`}
          {job.from !== null && <span className="whitespace-nowrap text-muted">{`\u00a0· since ${job.from}`}</span>}
        </p>
      )}
      <p className={`mt-4 border-t border-divider pt-4 ${NOTE}`}>
        <span className="font-semibold tracking-wide text-ok">FACT</span> verbatim quote from the linked source, checked by script.{" "}
        <span className="font-semibold tracking-wide text-inference">INFERENCE</span> derived from the quotes shown with it. Public data only; no
        contact data and no special-category data.
      </p>
      <nav aria-label="Profile sections" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {SECTIONS.filter(([id]) => present.has(id)).map(([id, label]) => (
          <a key={id} href={`#${id}`} className="font-medium text-action underline decoration-action/40 underline-offset-4 hover:decoration-action">
            {label}
          </a>
        ))}
      </nav>
    </section>
  );
}
