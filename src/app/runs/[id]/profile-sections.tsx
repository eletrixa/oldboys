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
 * - Verdict strip: run's role fit with a neutral bar and must-haves evidenced, risks, questions, FACT / INFERENCE and
 *   source counts, current role; FACT / INFERENCE legend; section anchors
 * - Sections in Robert's order with caps (3 / 3 / 5 jobs / 3 sentences / run's role / 5) and "Show N more"; empty ones omitted
 * - Evidence line: serif quote on a hairline rule, then one meta line: Independent / Self-reported pill (none on a weak INFERENCE), FACT / INFERENCE,
 *   supports / weakens / context, [n] source deep-linked at the quote, retrieved day, note;
 *   "source missing" for an unknown id; numbered Sources list with retrieved dates
 * - History as a timeline (date column, hairline, org · title); working style on a muted card with trait rows
 * - Position fit: one bar row per role, weighted capability table, formula behind a disclosure, Σ(weight × status) ÷ Σ(weight) computed here
 * - Position fit table stacks under 640px (name, status, labelled weights); each capability's evidence is a full-width row below it
 * - Prose capped at a 65ch measure; evidence summaries carry the item name for screen readers; "·" separators bind to the
 *   text before them so a wrap never starts a line with one
 *
 * Design constraints:
 * - Server-safe and pure: native <details>, no hooks; Radar semantic tokens only; no colour scale on fit %
 * - Working style and fit are labelled as inference / evidence coverage, never an assessment or a prediction
 * - Briefs stored before direction / note / detail / location / duration / traits / weight existed render through the
 *   schema defaults (direction falls back to `supports`)
 */
import type { HistoryEntry, PositionFit, Profile, ProfileEvidence, ProfileItem } from "@/domain/claim";
import { CARD, CARD_MUTED, Chevron, Eyebrow, LINK, Pill, SUMMARY, SUMMARY_COMPACT, type Tone } from "../../ui";
import { type Evidence, quoteLink, retrievedLabel } from "./evidence";
import { CV_SOURCE_TEXT, host, isCvSource } from "./state";

// Three type sizes inside the block: text-xs (meta), text-sm (body), text-xl serif (headings and figures).
const NOTE = "text-xs text-muted";
/** 65ch measure for anything read as prose (quotes, intros, details, the read). */
const MEASURE = "max-w-prose";
const INTRO = `mt-2 ${MEASURE} text-sm text-muted`;
const H2 = "mt-1 scroll-mt-6 font-serif text-xl";
const FIGURE = "font-serif text-xl leading-tight text-ink tabular-nums";

const plural = (n: number, one: string, many = `${one}s`): string => `${String(n)} ${n === 1 ? one : many}`;

type Direction = "supports" | "contradicts" | "context";
/** `direction` is optional for briefs stored before it existed; fall back to the boolean. */
const directionOf = (e: ProfileEvidence): Direction => e.direction ?? (e.supports ? "supports" : "contradicts");
const DIRECTION: Record<Direction, { text: string; cls: string }> = {
  supports: { text: "supports", cls: "text-ok" },
  contradicts: { text: "weakens", cls: "font-semibold text-conflict" },
  context: { text: "context", cls: "text-inference" },
};

/** "Retrieved 9 Oct 2026, 10:00 UTC" → "9 Oct 2026" for the one-line evidence meta. */
const retrievedDay = (iso: string | null | undefined): string => retrievedLabel(iso).replace(/^Retrieved /, "").replace(/,.*$/, "");

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

/** Section head: eyebrow (what kind of content) over the numbered serif title. */
function Head({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }): React.JSX.Element {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className={H2}>
        {title}
      </h2>
    </>
  );
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

/** Quiet quote block: serif quote on a hairline rule (conflict-tinted when it weakens), then one meta line. */
function EvidenceLine({ e, ctx }: { e: ProfileEvidence; ctx: Ctx }): React.JSX.Element {
  const info = ctx.evidence.sourceOf.get(e.source_id);
  const n = ctx.cite.get(e.source_id);
  const direction = directionOf(e);
  const dir = DIRECTION[direction];
  /** Segments never break inside (no split dates); the dot is tied to the segment before it by a no-break space, so a wrap lands after "·", never before it. */
  const seg = (key: string, node: React.ReactNode, first = false): React.JSX.Element => (
    <span key={key}>
      {first ? " " : <span aria-hidden="true">{"\u00a0· "}</span>}
      <span className="whitespace-nowrap">{node}</span>
    </span>
  );
  return (
    <li className={`border-l pl-4 ${direction === "contradicts" ? "border-conflict" : "border-divider"}`}>
      <blockquote className={`${MEASURE} font-serif text-sm text-ink`}>“{e.quote}”</blockquote>
      <p className={`mt-1 ${NOTE}`}>
        {/* A weak INFERENCE line gets no strength pill: the INFERENCE label already says it is not a checked quote. */}
        {(e.strength === "strong" || e.kind === "FACT") && (
          <Pill tone={e.strength === "strong" ? "ok" : "unsure"} className="px-2 py-0">
            {e.strength === "strong" ? "Independent" : "Self-reported"}
          </Pill>
        )}
        {seg("kind", <span className={`font-semibold tracking-wide ${e.kind === "FACT" ? "text-ok" : "text-inference"}`}>{e.kind}</span>, true)}
        {seg("dir", <span className={dir.cls}>{dir.text}</span>)}
        {seg(
          "src",
          info === undefined || n === undefined ? (
            <span>source missing</span>
          ) : isCvSource(info.url) ? (
            <span>{`[${String(n)}] ${CV_SOURCE_TEXT}`}</span>
          ) : (
            <a href={quoteLink(info.url, e.quote)} target="_blank" rel="noreferrer" title={info.url} className={LINK}>
              {`[${String(n)}] ${host(info.url)}`}
            </a>
          ),
        )}
        {info !== undefined && seg("day", <span className="tabular-nums">{retrievedDay(info.fetched_at)}</span>)}
        {e.note !== "" && <span>{`\u00a0· ${e.note}`}</span>}
      </p>
    </li>
  );
}

/** `about` names the item for screen readers, so a page of "Evidence (2)" summaries stays distinguishable. Each summary part ends with its own "·" so a wrap never starts a line with it. */
function EvidenceList({ items, ctx, about }: { items: ProfileEvidence[]; ctx: Ctx; about: string }): React.JSX.Element | null {
  if (items.length === 0) return null;
  const against = items.filter((e) => directionOf(e) === "contradicts").length;
  const independent = items.filter((e) => e.strength === "strong").length;
  return (
    <details className="group mt-1">
      <summary className={SUMMARY_COMPACT}>
        <Chevron />
        <span>
          {`Evidence (${String(items.length)})`}
          <span className="sr-only">{` for ${about}`}</span>
          {"\u00a0·"}
        </span>
        <span className={independent === 0 ? "font-medium text-unsure" : "font-medium"}>
          {independent === 0 ? "all self-reported" : `${String(independent)} independent`}
          {against > 0 && "\u00a0·"}
        </span>
        {against > 0 && <span className="text-conflict">{`${String(against)} weakens`}</span>}
      </summary>
      <ul className="mt-2 mb-2 space-y-4 [overflow-wrap:anywhere]">
        {items.map((e, i) => (
          <EvidenceLine key={`${e.source_id}-${String(i)}`} e={e} ctx={ctx} />
        ))}
      </ul>
    </details>
  );
}

/** `quiet` drops the bold title for inference rows (working style), so they never outweigh the facts. */
function ItemRows({ items, ctx, quiet = false }: { items: ProfileItem[]; ctx: Ctx; quiet?: boolean }): React.JSX.Element {
  return (
    <ul className="divide-y divide-divider">
      {items.map((it) => (
        <li key={it.text} className="py-4">
          <h3 className={`text-sm text-ink ${quiet ? "" : "font-semibold"}`}>{it.text}</h3>
          {it.detail !== "" && <p className={`mt-1 ${MEASURE} text-sm text-muted`}>{it.detail}</p>}
          <EvidenceList items={it.evidence} ctx={ctx} about={it.text} />
        </li>
      ))}
    </ul>
  );
}

function Capped({ items, visible, ctx, quiet = false }: { items: ProfileItem[]; visible: number; ctx: Ctx; quiet?: boolean }): React.JSX.Element {
  const rest = items.slice(visible);
  return (
    <div className="mt-2">
      <ItemRows items={items.slice(0, visible)} ctx={ctx} quiet={quiet} />
      {rest.length > 0 && (
        <More label={`Show ${String(rest.length)} more`}>
          <ItemRows items={rest} ctx={ctx} quiet={quiet} />
        </More>
      )}
    </div>
  );
}

function Items(props: { id: string; eyebrow: string; title: string; intro: string; items: ProfileItem[]; dropped: number; ctx: Ctx }): React.JSX.Element {
  return (
    <section className={CARD}>
      <Head id={props.id} eyebrow={props.eyebrow} title={props.title} />
      <p className={INTRO}>{props.intro}</p>
      <Capped items={props.items} visible={3} ctx={props.ctx} />
      <Dropped n={props.dropped} />
    </section>
  );
}

const dates = (h: HistoryEntry): string => (h.from === null && h.to === null ? "" : `${h.from ?? "?"} – ${h.to ?? "Present"}`);

/** Timeline: date column, hairline with a node per entry, org · title, summary, evidence. */
function HistoryRows({ entries, ctx }: { entries: HistoryEntry[]; ctx: Ctx }): React.JSX.Element {
  return (
    <ol>
      {entries.map((h) => (
        <li key={`${h.organization}-${h.title}-${h.from ?? ""}`}>
          {/* Date sits in a left column from sm up; on phones it heads the entry on the rail so the text keeps the width. */}
          <div className="relative border-l border-divider pb-6 pl-4 before:absolute before:top-1.5 before:-left-1 before:size-2 before:rounded-full before:border before:border-line before:bg-surface sm:ml-36">
            <p className="mb-1 text-xs text-ink tabular-nums sm:absolute sm:top-px sm:-left-36 sm:mb-0 sm:w-32">
              {dates(h)}
              {h.duration !== "" && (
                <>
                  <span className="text-muted sm:hidden">{"\u00a0· "}</span>
                  <span className="text-muted sm:block">{h.duration}</span>
                </>
              )}
            </p>
            <h3 className="text-sm font-semibold text-ink">
              {h.organization}
              <span className="font-normal text-ink">
                <span className="text-muted">{"\u00a0· "}</span>
                {h.title}
              </span>
              {h.kind !== "job" && (
                <Pill tone="neutral" className="ml-2 py-0">
                  {h.kind}
                </Pill>
              )}
            </h3>
            {h.location !== "" && <p className={NOTE}>{h.location}</p>}
            {h.summary !== "" && <p className={`mt-1 ${MEASURE} text-sm text-muted`}>{h.summary}</p>}
            <EvidenceList items={h.evidence} ctx={ctx} about={`${h.organization}, ${h.title}`} />
          </div>
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
      <Head id="history" eyebrow="Career" title="3. History" />
      <p className={INTRO}>Jobs as LinkedIn lists them (self-reported, newest first), then education, projects and community.</p>
      <div className="mt-6">
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
    <section className={CARD_MUTED}>
      <Head id="working-style" eyebrow="Inference" title="4. Working style" />
      <p className="mt-2">
        <Pill tone="inference">Inference from public writing, not an assessment of the person.</Pill>
      </p>
      <p className={`mt-2 ${NOTE}`}>
        Based only on their own posts, articles and interview text. No health, political, religious, ethnic or sexual-orientation data is used.
      </p>
      {/* One column on phones (label above value) so the read and its evidence keep the full card width. */}
      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-y-2">
        {types.length === 0 ? (
          <>
            <dt className={NOTE}>Type</dt>
            <dd className="text-muted">Not enough of their own writing to suggest a type</dd>
          </>
        ) : (
          types.map((v) => (
            <div key={v.label} className="contents">
              <dt className={`${NOTE} pt-px`}>{v.label}</dt>
              <dd className="text-ink">
                {`${v.label} ${v.type}`}
                <span className="text-muted">{`\u00a0· ${v.confidence} confidence`}</span>
              </dd>
            </div>
          ))
        )}
        {read.length > 0 && (
          <>
            <dt className={`${NOTE} pt-px`}>Our read</dt>
            <dd>
              <p className={`${MEASURE} text-ink`}>
                {read.slice(0, VISIBLE).join(" ")}
                {p.evidence.length === 0 && traits.length === 0 && <span className="text-muted"> (no supporting quote kept)</span>}
              </p>
              {read.length > VISIBLE && (
                <details className="group">
                  <summary className={SUMMARY_COMPACT}>
                    <Chevron />
                    {`Show ${plural(read.length - VISIBLE, "more sentence", "more sentences")}`}
                  </summary>
                  <p className={`${MEASURE} text-ink`}>{read.slice(VISIBLE).join(" ")}</p>
                </details>
              )}
              <EvidenceList items={p.evidence} ctx={ctx} about="our read" />
            </dd>
          </>
        )}
      </dl>
      {traits.length > 0 && <Capped items={traits} visible={4} ctx={ctx} quiet />}
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

const evidenced = (f: PositionFit): string =>
  `${String(f.traits.filter((t) => t.status === "has").length)} of ${String(f.traits.length)} must-haves evidenced`;

/** Thin neutral bar; never a colour scale. */
function Bar({ pct }: { pct: number }): React.JSX.Element {
  return (
    <span aria-hidden="true" className="block h-1 w-full overflow-hidden rounded-full bg-divider">
      <span className="block h-full rounded-full bg-muted" style={{ width: `${String(Math.min(100, Math.max(0, pct)))}%` }} />
    </span>
  );
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
      <Head id="fit" eyebrow="Evidence coverage" title="5. Position fit" />
      <p className={INTRO}>Share of the role profile with public evidence, not a performance prediction.</p>
      <ul className="mt-4 space-y-4">
        {fits.map((f) => (
          <li key={f.role} className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-4">
            <span className={FIGURE}>{String(fitPct(f))}%</span>
            <span className="text-sm">
              <span className={f === main ? "font-semibold text-ink" : "text-muted"}>{f.role}</span>
              <span className="mt-2 mb-1 block">
                <Bar pct={fitPct(f)} />
              </span>
              <span className={NOTE}>{evidenced(f)}</span>
            </span>
          </li>
        ))}
      </ul>
      <details className="group mt-2">
        <summary className={SUMMARY_COMPACT}>
          <Chevron />
          How the % is computed
        </summary>
        <p className={`mb-2 ${NOTE}`}>
          Each capability has a weight per role from 0 (not needed) to 3 (critical); evidence counts Has 1, Partial 0.5, No evidence 0; fit =
          Σ(weight × status) ÷ Σ(weight).
        </p>
      </details>
      {/* From sm up a table (scrolls sideways past three roles); under 640px each capability stacks: name, status and
          labelled weights, then its evidence. Evidence sits in its own full-width row below the capability, never in a cell. */}
      <div className="mt-4 sm:overflow-x-auto">
        <table className={`w-full border-collapse text-left text-sm max-sm:block ${fits.length > 1 ? "sm:min-w-[32rem]" : ""}`}>
          <thead className={`${NOTE} max-sm:sr-only`}>
            <tr className="border-b border-divider">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Capability
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                Evidence
              </th>
              {fits.map((f) => (
                <th key={f.role} scope="col" className="py-2 text-right font-semibold">
                  {fits.length > 1 ? f.role : "Weight"}
                  {fits.length > 1 && <span className="block font-normal">weight</span>}
                </th>
              ))}
            </tr>
          </thead>
          {rows.map(({ name, per }) => {
            const t = per.find((x) => x !== undefined);
            return (
              <tbody key={name} className="border-t border-divider max-sm:block max-sm:py-2 max-sm:first-of-type:border-t-0">
                <tr className="align-top max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-1">
                  <th scope="row" className="py-2 pr-4 font-normal text-ink max-sm:w-full max-sm:p-0">
                    {name}
                  </th>
                  <td className="py-2 pr-4 max-sm:p-0">{t !== undefined && <Pill tone={STATUS[t.status].tone} className="whitespace-nowrap">{STATUS[t.status].text}</Pill>}</td>
                  {per.map((x, i) => (
                    <td key={fits[i]?.role ?? i} className="py-2 text-right text-muted tabular-nums max-sm:p-0 max-sm:text-xs">
                      <span className="sm:hidden">{fits.length > 1 ? `${fits[i]?.role ?? ""} weight ` : "weight "}</span>
                      {x === undefined ? "–" : String(x.weight)}
                    </td>
                  ))}
                </tr>
                {t !== undefined && t.evidence.length > 0 && (
                  <tr className="max-sm:block">
                    <td colSpan={2 + fits.length} className="pb-2 max-sm:block max-sm:p-0">
                      <EvidenceList items={t.evidence} ctx={ctx} about={name} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
      {main !== undefined && main.rationale !== "" && <p className={`mt-4 ${MEASURE} ${NOTE}`}>{main.rationale}</p>}
      <Dropped n={dropped} />
    </section>
  );
}

function QuestionRows({ items, start }: { items: Profile["questions"]; start: number }): React.JSX.Element {
  return (
    <ol start={start} className="divide-y divide-divider">
      {items.map((q, i) => (
        <li key={q.text} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 py-4">
          <span className="text-sm font-semibold text-action tabular-nums">{String(start + i).padStart(2, "0")}</span>
          <span className="text-sm">
            <span className="font-semibold text-ink">{q.text}</span>
            {q.closes !== "" && (
              <span className={`mt-1 block ${NOTE}`}>
                closes: <span className="text-ink">{q.closes.replace(/^closes:?\s+/i, "")}</span>
              </span>
            )}
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
      <Head id="ask" eyebrow="Interview" title="6. What to ask" />
      <p className={INTRO}>Interview questions from the risks and gaps above. Each says which one it closes.</p>
      <div className="mt-2">
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
              <li key={id} className="py-1">
                {isCvSource(info.url) ? (
                  <span className="text-muted">{CV_SOURCE_TEXT}</span>
                ) : (
                  <a href={info.url} target="_blank" rel="noreferrer" className="text-action underline decoration-action/40 underline-offset-2">
                    {info.url}
                  </a>
                )}
                <span className="text-muted">{`\u00a0· ${retrievedLabel(info.fetched_at)}`}</span>
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

/** Verdict strip the recruiter reads first: fit with bar, risks, questions, evidence; then current role, legend, anchors. */
function SummaryBox({ profile, fits, all, ctx, present }: { profile: Profile; fits: PositionFit[]; all: ProfileEvidence[]; ctx: Ctx; present: ReadonlySet<string> }): React.JSX.Element {
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
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
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
        <div className="grid gap-4 md:grid-cols-2">
          {show.achievements && (
            <Items
              id="achievements"
              eyebrow="Track record"
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
              eyebrow="To check"
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
