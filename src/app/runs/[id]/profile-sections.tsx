/**
 * Enriched hiring profile on the report page, in the structure Robert approved (scratchpad prototype, 2026-10-09):
 * summary box, achievements, risks, history, working style, position fit, what to ask, sources. Every item carries its
 * evidence lines behind a native disclosure; caps from docs/research/profile-page-discovery.md §5 keep it compact.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/profile-sections.tsx
 * Deps:    react, src/domain/claim (types), ../../ui (Radar primitives), ./evidence (Evidence, quoteLink, retrievedLabel)
 * Tested:  src/app/runs/[id]/__tests__/profile-sections.test.ts
 *
 * Key responsibilities:
 * - Summary box: current role, sources and FACT / INFERENCE counts, run's role fit with must-haves evidenced, risks,
 *   questions; FACT / INFERENCE legend; section anchors
 * - Sections in Robert's order with caps (3 / 3 / 5 jobs / 3 sentences / run's role / 5) and "Show N more"; empty ones omitted
 * - Evidence line: FACT / INFERENCE, Supports / Contradicts / Context, the quote, [n] source deep-linked at the quote,
 *   note; "source missing" for an unknown id; numbered Sources list with retrieved dates
 * - Position fit: one card per role, weighted capability table, Σ(weight × status) ÷ Σ(weight) computed here
 *
 * Design constraints:
 * - Server-safe and pure: native <details>, no hooks; Radar semantic tokens only; no colour scale on fit %
 * - Working style and fit are labelled as inference / evidence coverage, never an assessment or a prediction
 * - Briefs stored before direction / note / detail / location / duration / traits / weight existed render through the
 *   schema defaults (direction falls back to `supports`)
 */
import type { HistoryEntry, PositionFit, Profile, ProfileEvidence, ProfileItem } from "@/domain/claim";
import { CARD, Chevron, LINK, Pill, SUMMARY, SUMMARY_COMPACT, type Tone } from "../../ui";
import { type Evidence, quoteLink, retrievedLabel } from "./evidence";
import { CV_SOURCE_TEXT, host, isCvSource } from "./state";

const NOTE = "text-xs text-muted";
const INTRO = "mt-1 text-sm text-muted";
const H2 = "scroll-mt-6 font-serif text-xl";

const plural = (n: number, one: string, many = `${one}s`): string => `${String(n)} ${n === 1 ? one : many}`;

type Direction = "supports" | "contradicts" | "context";
/** `direction` is optional for briefs stored before it existed; fall back to the boolean. */
const directionOf = (e: ProfileEvidence): Direction => e.direction ?? (e.supports ? "supports" : "contradicts");
const DIRECTION: Record<Direction, { text: string; cls: string }> = {
  supports: { text: "Supports", cls: "text-ok" },
  contradicts: { text: "Contradicts", cls: "text-conflict" },
  context: { text: "Context", cls: "text-inference" },
};

/** Source number by first use, in page order, so evidence lines cite [n] and the Sources list matches. */
type Cite = ReadonlyMap<string, number>;

function allEvidence(p: Profile): ProfileEvidence[] {
  const items = (xs: { evidence: ProfileEvidence[] }[]): ProfileEvidence[] => xs.flatMap((x) => x.evidence);
  return [
    ...items(p.achievements),
    ...items(p.risks),
    ...items(p.history),
    ...items(p.personality.traits),
    ...p.personality.evidence,
    ...p.position_fit.flatMap((f) => items(f.traits)),
  ];
}

function citeOf(all: ProfileEvidence[], evidence: Evidence): Cite {
  const cite = new Map<string, number>();
  for (const e of all) if (evidence.sourceOf.has(e.source_id) && !cite.has(e.source_id)) cite.set(e.source_id, cite.size + 1);
  return cite;
}

type Ctx = { evidence: Evidence; cite: Cite };

function Dropped({ n }: { n: number }): React.JSX.Element | null {
  return n > 0 ? <p className={`mt-2 ${NOTE}`}>{plural(n, "line")} dropped by the quote check</p> : null;
}

/** Collapsed tail of a capped list. */
function More({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <details className="group">
      <summary className={SUMMARY}>
        <Chevron />
        {label}
      </summary>
      {children}
    </details>
  );
}

function EvidenceLine({ e, ctx }: { e: ProfileEvidence; ctx: Ctx }): React.JSX.Element {
  const info = ctx.evidence.sourceOf.get(e.source_id);
  const n = ctx.cite.get(e.source_id);
  const dir = DIRECTION[directionOf(e)];
  return (
    <li className="py-2 text-sm first:pt-0 last:pb-0">
      <span className="mr-2 inline-flex items-center gap-1.5 align-[1px]">
        <Pill tone={e.kind === "FACT" ? "ok" : "inference"} className="px-2 py-0 text-[0.6875rem] tracking-wide">
          {e.kind}
        </Pill>
        <span className={`rounded border border-divider px-1.5 text-[0.6875rem] font-semibold ${dir.cls}`}>{dir.text}</span>
      </span>
      <span className="font-serif text-ink">“{e.quote}”</span>{" "}
      {info === undefined || n === undefined ? (
        <span className={NOTE}>source missing</span>
      ) : isCvSource(info.url) ? (
        <span className={NOTE}>{`[${String(n)}] ${CV_SOURCE_TEXT}`}</span>
      ) : (
        <a href={quoteLink(info.url, e.quote)} target="_blank" rel="noreferrer" title={info.url} className={`${LINK} text-xs`}>
          {`[${String(n)}] ${host(info.url)}`}
        </a>
      )}
      {e.note !== "" && <span className={NOTE}>{` · ${e.note}`}</span>}
    </li>
  );
}

function EvidenceList({ items, ctx }: { items: ProfileEvidence[]; ctx: Ctx }): React.JSX.Element | null {
  if (items.length === 0) return null;
  const against = items.filter((e) => directionOf(e) === "contradicts").length;
  return (
    <details className="group">
      <summary className={SUMMARY_COMPACT}>
        <Chevron />
        Evidence ({String(items.length)})
        {against > 0 && <span className="font-medium text-conflict">· {String(against)} contradicts</span>}
      </summary>
      <ul className="divide-y divide-divider rounded-xl border border-divider bg-canvas p-3 [overflow-wrap:anywhere]">
        {items.map((e, i) => (
          <EvidenceLine key={`${e.source_id}-${String(i)}`} e={e} ctx={ctx} />
        ))}
      </ul>
    </details>
  );
}

function ItemRows({ items, ctx }: { items: ProfileItem[]; ctx: Ctx }): React.JSX.Element {
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.text} className="py-2.5">
          <h3 className="text-sm font-semibold text-ink">{it.text}</h3>
          {it.detail !== "" && <p className="mt-0.5 text-sm text-muted">{it.detail}</p>}
          <EvidenceList items={it.evidence} ctx={ctx} />
        </li>
      ))}
    </ul>
  );
}

function Capped({ items, visible, ctx }: { items: ProfileItem[]; visible: number; ctx: Ctx }): React.JSX.Element {
  const rest = items.slice(visible);
  return (
    <div className="mt-1">
      <ItemRows items={items.slice(0, visible)} ctx={ctx} />
      {rest.length > 0 && (
        <More label={`Show ${String(rest.length)} more`}>
          <ItemRows items={rest} ctx={ctx} />
        </More>
      )}
    </div>
  );
}

function Items(props: { id: string; title: string; intro: string; items: ProfileItem[]; dropped: number; ctx: Ctx }): React.JSX.Element {
  return (
    <section className={CARD}>
      <h2 id={props.id} className={H2}>
        {props.title}
      </h2>
      <p className={INTRO}>{props.intro}</p>
      <Capped items={props.items} visible={3} ctx={props.ctx} />
      <Dropped n={props.dropped} />
    </section>
  );
}

const dates = (h: HistoryEntry): string => (h.from === null && h.to === null ? "" : `${h.from ?? "?"} – ${h.to ?? "Present"}`);

function HistoryRows({ entries, ctx }: { entries: HistoryEntry[]; ctx: Ctx }): React.JSX.Element {
  return (
    <ol className="divide-y divide-divider">
      {entries.map((h) => (
        <li key={`${h.organization}-${h.title}-${h.from ?? ""}`} className="py-2.5 text-sm">
          <p className={`${NOTE} tabular-nums`}>{[dates(h), h.duration, h.location].filter((s) => s !== "").join(" · ")}</p>
          <h3 className="flex flex-wrap items-baseline gap-x-2 font-semibold text-ink">
            {h.title}, {h.organization}
            {h.kind !== "job" && <Pill tone="neutral">{h.kind}</Pill>}
          </h3>
          {h.summary !== "" && <p className="text-muted">{h.summary}</p>}
          <EvidenceList items={h.evidence} ctx={ctx} />
        </li>
      ))}
    </ol>
  );
}

function History({ entries, dropped, ctx }: { entries: HistoryEntry[]; dropped: number; ctx: Ctx }): React.JSX.Element {
  const VISIBLE = 5;
  const jobs = entries.filter((h) => h.kind === "job");
  const other = entries.filter((h) => h.kind !== "job");
  const older = jobs.slice(VISIBLE);
  return (
    <section className={CARD}>
      <h2 id="history" className={H2}>
        3. History
      </h2>
      <p className={INTRO}>Jobs as LinkedIn lists them (self-reported, newest first), then education, projects and community.</p>
      <div className="mt-1">
        <HistoryRows entries={jobs.slice(0, VISIBLE)} ctx={ctx} />
        {older.length > 0 && (
          <More label={`Show ${String(older.length)} earlier ${older.length === 1 ? "job" : "jobs"}`}>
            <HistoryRows entries={older} ctx={ctx} />
          </More>
        )}
        {other.length > 0 && (
          <More label={`Education, projects and community (${String(other.length)})`}>
            <HistoryRows entries={other} ctx={ctx} />
          </More>
        )}
      </div>
      <Dropped n={dropped} />
    </section>
  );
}

/** Sentence split for model prose; no abbreviation handling. */
const sentences = (text: string): string[] => text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g)?.map((s) => s.trim()) ?? [];

function WorkingStyle({ p, ctx }: { p: Profile["personality"]; ctx: Ctx }): React.JSX.Element {
  const types = [
    { label: "DISC", v: p.disc },
    { label: "MBTI", v: p.mbti },
  ].flatMap(({ label, v }) => (v === null ? [] : [{ label, ...v }]));
  const read = sentences(p.read);
  const { traits } = p;
  const VISIBLE = 3;
  return (
    <section className={CARD}>
      <h2 id="working-style" className={H2}>
        4. Working style
      </h2>
      <div className="mt-2 rounded-xl border border-inference/30 bg-inference-bg px-4 py-3 text-sm text-ink">
        <strong>Inference from public writing, not an assessment of the person.</strong> Based only on their own posts,
        articles and interview text. No health, political, religious, ethnic or sexual-orientation data is used.
      </div>
      <p className="mt-3 flex flex-wrap gap-2">
        {types.length === 0 ? (
          <span className={NOTE}>Not enough of their own writing to suggest a type</span>
        ) : (
          types.map((v) => (
            <Pill key={v.label} tone="neutral">
              {v.label} {v.type} · {v.confidence} confidence
            </Pill>
          ))
        )}
      </p>
      {read.length > 0 && (
        <div className="mt-3 rounded-xl border border-divider bg-canvas px-4 py-3">
          <h3 className="text-sm font-semibold">Our read</h3>
          <p className="mt-1 text-sm text-ink">
            {read.slice(0, VISIBLE).join(" ")}
            {p.evidence.length === 0 && traits.length === 0 && <span className="text-muted"> (no supporting quote kept)</span>}
          </p>
          {read.length > VISIBLE && (
            <More label="Read the rest">
              <p className="text-sm text-ink">{read.slice(VISIBLE).join(" ")}</p>
            </More>
          )}
          <EvidenceList items={p.evidence} ctx={ctx} />
        </div>
      )}
      {traits.length > 0 && <Capped items={traits} visible={4} ctx={ctx} />}
      <Dropped n={p.evidence_dropped} />
    </section>
  );
}

const STATUS: Record<"has" | "partial" | "none", { text: string; tone: Tone; score: number }> = {
  has: { text: "Has", tone: "ok", score: 1 },
  partial: { text: "Partial", tone: "unsure", score: 0.5 },
  none: { text: "No evidence", tone: "neutral", score: 0 },
};

/** Σ(weight × status) ÷ Σ(weight), as a whole %; the stored fit_pct when no capability carries weight. */
function fitPct(f: PositionFit): number {
  const total = f.traits.reduce((s, t) => s + t.weight, 0);
  if (total === 0) return f.fit_pct;
  return Math.round((f.traits.reduce((s, t) => s + t.weight * STATUS[t.status].score, 0) / total) * 100);
}

/** The run's role first (matched by name, else the first card), then the adjacent roles. */
function orderFits(fits: PositionFit[], role: string | null): PositionFit[] {
  const want = role?.trim().toLowerCase();
  const i = Math.max(0, fits.findIndex((f) => f.role.trim().toLowerCase() === want));
  const main = fits[i];
  return main === undefined ? [] : [main, ...fits.filter((_, j) => j !== i)];
}

function Fit({ fits, dropped, ctx }: { fits: PositionFit[]; dropped: number; ctx: Ctx }): React.JSX.Element {
  const [main] = fits;
  const rows = [...new Set(fits.flatMap((f) => f.traits.map((t) => t.trait)))].map((name) => ({
    name,
    per: fits.map((f) => f.traits.find((t) => t.trait === name)),
  }));
  return (
    <section className={CARD}>
      <h2 id="fit" className={H2}>
        5. Position fit
      </h2>
      <p className={INTRO}>
        Share of the role profile with public evidence, not a performance prediction. Each capability has a weight per role
        from 0 (not needed) to 3 (critical); evidence counts Has 1, Partial 0.5, No evidence 0; fit = Σ(weight × status) ÷
        Σ(weight).
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fits.map((f) => (
          <li key={f.role} className={`rounded-xl border px-3 py-2 ${f === main ? "border-ink/40 bg-surface" : "border-divider bg-canvas"}`}>
            <span className="block font-serif text-2xl text-ink tabular-nums">{String(fitPct(f))}%</span>
            <span className="text-xs text-muted">{f.role}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-divider">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Capability
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Evidence
              </th>
              {fits.map((f) => (
                <th key={f.role} scope="col" className="py-2 pr-3 text-center font-semibold">
                  {f.role}
                  <span className="block font-normal">weight</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {rows.map(({ name, per }) => {
              const t = per.find((x) => x !== undefined);
              return (
                <tr key={name} className="align-top">
                  <th scope="row" className="py-1.5 pr-3 font-normal text-ink">
                    {name}
                    {t !== undefined && <EvidenceList items={t.evidence} ctx={ctx} />}
                  </th>
                  <td className="py-1.5 pr-3">{t !== undefined && <Pill tone={STATUS[t.status].tone}>{STATUS[t.status].text}</Pill>}</td>
                  {per.map((x, i) => (
                    <td key={fits[i]?.role ?? i} className="py-1.5 pr-3 text-center tabular-nums">
                      {x === undefined ? "–" : String(x.weight)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {main !== undefined && main.rationale !== "" && <p className={`mt-2 ${NOTE}`}>{main.rationale}</p>}
      <Dropped n={dropped} />
    </section>
  );
}

function QuestionRows({ items, start }: { items: Profile["questions"]; start: number }): React.JSX.Element {
  return (
    <ol start={start} className="divide-y divide-divider">
      {items.map((q, i) => (
        <li key={q.text} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 py-2">
          <span className="font-serif text-lg text-action tabular-nums">{start + i}</span>
          <span className="text-sm">
            <strong className="font-semibold text-ink">{q.text}</strong>
            {q.closes !== "" && <span className={`block ${NOTE}`}>Closes: {q.closes}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Questions({ items }: { items: Profile["questions"] }): React.JSX.Element {
  const VISIBLE = 5;
  const rest = items.slice(VISIBLE);
  return (
    <section className={CARD}>
      <h2 id="ask" className={H2}>
        6. What to ask
      </h2>
      <p className={INTRO}>Interview questions from the risks and gaps above. Each says which one it closes.</p>
      <div className="mt-1">
        <QuestionRows items={items.slice(0, VISIBLE)} start={1} />
        {rest.length > 0 && (
          <More label={`Show ${String(rest.length)} more`}>
            <QuestionRows items={rest} start={VISIBLE + 1} />
          </More>
        )}
      </div>
    </section>
  );
}

function Sources({ ctx }: { ctx: Ctx }): React.JSX.Element | null {
  if (ctx.cite.size === 0) return null;
  return (
    <section className={CARD}>
      <More label={`Sources (${String(ctx.cite.size)})`}>
        <ol className="list-decimal pl-6 text-xs [overflow-wrap:anywhere]">
          {[...ctx.cite.keys()].map((id) => {
            const info = ctx.evidence.sourceOf.get(id);
            if (info === undefined) return null;
            return (
              <li key={id} className="py-0.5">
                {isCvSource(info.url) ? (
                  <span className="text-muted">{CV_SOURCE_TEXT}</span>
                ) : (
                  <a href={info.url} target="_blank" rel="noreferrer" className="text-action underline decoration-action/40 underline-offset-2">
                    {info.url}
                  </a>
                )}
                <span className="text-muted"> · {retrievedLabel(info.fetched_at)}</span>
              </li>
            );
          })}
        </ol>
      </More>
    </section>
  );
}

const SECTIONS = [
  ["achievements", "Achievements"],
  ["risks", "Risks"],
  ["history", "History"],
  ["working-style", "Working style"],
  ["fit", "Position fit"],
  ["ask", "What to ask"],
] as const;

/** Counts the recruiter reads first, plus the FACT / INFERENCE legend and section anchors. */
function SummaryBox({ profile, fits, all, ctx, present }: { profile: Profile; fits: PositionFit[]; all: ProfileEvidence[]; ctx: Ctx; present: ReadonlySet<string> }): React.JSX.Element {
  const job = profile.history.find((h) => h.kind === "job");
  const [fit] = fits;
  const has = fit?.traits.filter((t) => t.status === "has").length ?? 0;
  const facts = all.filter((e) => e.kind === "FACT").length;
  const cells: [string, string, string?][] = [
    ...(job === undefined ? [] : [["Current role", `${job.title}, ${job.organization}`, job.from === null ? undefined : `since ${job.from}`] as [string, string, string?]]),
    ["Sources", String(ctx.cite.size)],
    ["Evidence", `${plural(facts, "fact")} · ${plural(all.length - facts, "inference")}`],
    ...(fit === undefined ? [] : [[`Fit, ${fit.role}`, `${String(fitPct(fit))}%`, `${String(has)} of ${String(fit.traits.length)} must-haves evidenced`] as [string, string, string?]]),
    ["Risks · questions", `${String(profile.risks.length)} · ${String(profile.questions.length)}`],
  ];
  return (
    <section className={CARD}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-5">
        {cells.map(([label, value, sub]) => (
          <div key={label}>
            <dt className={NOTE}>{label}</dt>
            <dd className="font-serif text-lg leading-snug text-ink tabular-nums">{value}</dd>
            {sub !== undefined && <dd className={NOTE}>{sub}</dd>}
          </div>
        ))}
      </dl>
      <p className={`mt-3 border-t border-divider pt-3 ${NOTE}`}>
        <Pill tone="ok" className="px-2 py-0 text-[0.6875rem]">
          FACT
        </Pill>{" "}
        verbatim quote from the linked source, checked by script.{" "}
        <Pill tone="inference" className="px-2 py-0 text-[0.6875rem]">
          INFERENCE
        </Pill>{" "}
        derived from the quotes shown with it. Public data only; no contact data and no special-category data.
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

export function ProfileSections({ profile, evidence, role = null }: { profile: Profile; evidence: Evidence; role?: string | null }): React.JSX.Element {
  if (profile.degraded !== null) return <p className="text-sm text-muted">Profile not built: {profile.degraded}</p>;
  const p = profile.personality;
  const all = allEvidence(profile);
  const ctx: Ctx = { evidence, cite: citeOf(all, evidence) };
  const fits = orderFits(profile.position_fit, role);
  const show = {
    achievements: profile.achievements.length > 0,
    risks: profile.risks.length > 0,
    history: profile.history.length > 0,
    "working-style": p.disc !== null || p.mbti !== null || p.read !== "" || p.traits.length > 0,
    fit: fits.length > 0,
    ask: profile.questions.length > 0,
  };
  const present = new Set(Object.entries(show).flatMap(([k, v]) => (v ? [k] : [])));
  return (
    <>
      <SummaryBox profile={profile} fits={fits} all={all} ctx={ctx} present={present} />
      {(show.achievements || show.risks) && (
        <div className="grid items-start gap-4 md:grid-cols-2">
      {show.achievements && (
        <Items
          id="achievements"
          title="1. Achievements"
          intro="Concrete results credited to them. Most are self-reported; the evidence marks what confirms or limits each one."
          items={profile.achievements}
          dropped={profile.achievements_dropped}
          ctx={ctx}
        />
      )}
      {show.risks && (
        <Items
          id="risks"
          title="2. Risks"
          intro="Hiring risks visible in public data. Each is a fact pattern to check, not a judgement of the person."
          items={profile.risks}
          dropped={profile.risks_dropped}
          ctx={ctx}
        />
      )}
        </div>
      )}
      {show.history && <History entries={profile.history} dropped={profile.history_dropped} ctx={ctx} />}
      {show["working-style"] && <WorkingStyle p={p} ctx={ctx} />}
      {show.fit && <Fit fits={fits} dropped={profile.fit_dropped} ctx={ctx} />}
      {show.ask && <Questions items={profile.questions} />}
      <Sources ctx={ctx} />
    </>
  );
}
