/**
 * Landing "Careful by design": trust shown through product behaviour, five tiles each with a fragment of the real UI.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/landing/careful.tsx
 * Deps:    ./parts, ./evidence-data, ../ui
 * Tested:  n/a (visual)
 *
 * Key responsibilities:
 * - Traceable sources (quote, host, retrieval date, "Confirmed: …"), explicit uncertainty (coverage words + Fact /
 *   Inference), research boundaries (searched / not searched / never), a person decides (audit record), the
 *   candidate is told (notice EN | CZ, 7-day deletion)
 *
 * Design constraints:
 * - Every fragment mirrors a feature the app has today: Show evidence, coverage pills, research limits, audit record
 *   (src/domain/audit.ts), candidate notice (candidate-copy.ts, -cs.ts), RETENTION_DAYS = 7
 * - Hairline tiles, not boxed cards; fragments are illustrations (spans), never fake buttons
 */
import { Eyebrow, FRAG, Pill, TILE } from "../ui";
import { EVIDENCED, NOT_SEARCHED, SEARCHED } from "./evidence-data";
import { Section, Title } from "./parts";

const CHIP = "inline-flex min-h-8 items-center rounded-md border border-divider bg-surface px-2.5 text-[13px] font-semibold";

function Tile({ title, body, wide = false, children }: Readonly<{ title: string; body: string; wide?: boolean; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className={`${TILE} gap-3 ${wide ? "lg:col-span-3" : "lg:col-span-2"}`}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-[15px] leading-relaxed text-pretty text-muted">{body}</p>
      <div className={FRAG}>{children}</div>
    </div>
  );
}

export function Careful(): React.JSX.Element {
  const sql = EVIDENCED;
  return (
    <Section id="trust">
      <div className="flex max-w-[44rem] flex-col gap-3">
        <Eyebrow>Trust</Eyebrow>
        <Title lead="Careful by design." rest="You can see it in the product." />
      </div>
      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
        <Tile title="Traceable sources" body="Every fact opens the quote and the page it came from, with the date Radar read it and why the source is the candidate's.">
          <p className="font-serif text-base leading-snug">“{sql.quote}”</p>
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-action">Open at the quote</span> · {sql.source?.host} · retrieved {sql.source?.read}
          </p>
          <p className="text-[13px] text-muted">Confirmed: {sql.source?.confirmed}</p>
        </Tile>
        <Tile title="Uncertainty in words" body="Coverage describes the research, never the person. Missing evidence stays open instead of counting against anyone.">
          <ul className="flex flex-col gap-2">
            <li className="flex items-center gap-2.5"><Pill tone="ok">evidenced</Pill><span className="text-muted">A source supports it.</span></li>
            <li className="flex items-center gap-2.5"><Pill tone="unsure">partial</Pill><span className="text-muted">Some support; details are open.</span></li>
            <li className="flex items-center gap-2.5"><Pill tone="neutral">none</Pill><span className="text-muted">No source yet. Ask about it.</span></li>
            <li className="flex items-center gap-2.5"><Pill tone="inference">Inference</Pill><span className="text-muted">Radar&apos;s reading, marked as such.</span></li>
          </ul>
        </Tile>
        <Tile title="Research boundaries" body="Radar looks only at public professional work for one named role, and each brief says where it did not look.">
          <p><span className="font-semibold">Searched:</span> <span className="text-muted">{SEARCHED}.</span></p>
          <p><span className="font-semibold">Not searched:</span> <span className="text-muted">{NOT_SEARCHED}</span></p>
          <p><span className="font-semibold">Never:</span> <span className="text-muted">private accounts, health, beliefs, family, origin or political views.</span></p>
        </Tile>
        <Tile wide title="A person decides" body="Radar never ranks, recommends or rejects anyone. Every brief keeps an audit record of who started it and which services processed the data.">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
            <dt className="font-semibold">Purpose</dt><dd className="text-muted">Pre-employment screening for one named role</dd>
            <dt className="font-semibold">Started by</dt><dd className="text-muted">The recruiter&apos;s account</dd>
            <dt className="font-semibold">Processed by</dt><dd className="text-muted">Cloudflare, plus Apify and Anthropic when the run used them</dd>
          </dl>
        </Tile>
        <Tile wide title="The candidate is told" body="A ready notice says who looked, why, which sources, and how to object. Research, saved excerpts and any CV are deleted after seven days.">
          <div className="flex flex-wrap items-center gap-2">
            <span className={CHIP}>Copy candidate notice</span>
            <span className="inline-flex overflow-hidden rounded-md border border-divider text-[13px] font-semibold">
              <span className="bg-ink px-2.5 py-1.5 text-white">EN</span>
              <span className="bg-surface px-2.5 py-1.5">CZ</span>
            </span>
          </div>
          <p className="text-[13px] text-muted">Deleted automatically 7 days after the brief, with an access export if the candidate asks for their data.</p>
        </Tile>
      </div>
    </Section>
  );
}
