/**
 * SEC EDGAR full-text search collector: filings that name the subject (free REST, no key).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/recipe/sources/sec-edgar.ts
 * Deps:    zod (REST via ports.fetchJson)
 * Tested:  src/recipe/__tests__/sources-sec-edgar.test.ts
 *
 * Key responsibilities:
 * - `rest/sec-edgar`: one overview Source (hit count and form mix) plus one Source per filing, newest first, max 25
 * - digest: `{ total, byForm, filings }` for the ledger
 *
 * Design constraints:
 * - Pure: no fetch here; unknown payload shapes parse to []
 * - EDGAR text is ASCII, so the searched name has diacritics stripped (case kept)
 * - Every excerpt carries the folded subject name; identity stays "unverified" (the corroboration pass upgrades it)
 */
import { z } from "zod";
import type { Collector, CollectorRequest, ParsedSource, StepContext } from "@/recipe/sources/types";
import { clip } from "@/recipe/sources/types";

const MAX_FILINGS = 25;
const MAX_FORMS = 8;

const Hit = z.object({
  _id: z.string().nullish(),
  _source: z
    .object({
      ciks: z.array(z.string()).nullish(),
      display_names: z.array(z.string()).nullish(),
      root_forms: z.array(z.string()).nullish(),
      form_type: z.string().nullish(),
      file_date: z.string().nullish(),
      file_description: z.string().nullish(),
    })
    .nullish(),
});

const Payload = z.object({
  hits: z
    .object({
      total: z.object({ value: z.number().nullish() }).nullish(),
      hits: z.array(Hit).nullish(),
    })
    .nullish(),
  aggregations: z
    .object({
      form_filter: z
        .object({ buckets: z.array(z.object({ key: z.union([z.string(), z.number()]), doc_count: z.number() })).nullish() })
        .nullish(),
    })
    .nullish(),
});

function asciiName(subject: string): string {
  return subject.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ");
}

function forms(p: z.infer<typeof Payload>): { form: string; count: number }[] {
  return (p.aggregations?.form_filter?.buckets ?? [])
    .slice(0, MAX_FORMS)
    .map((b) => ({ form: String(b.key), count: b.doc_count }));
}

function parsedSources(payload: unknown, ctx: StepContext): ParsedSource[] {
  const r = Payload.safeParse(payload);
  if (!r.success) return [];
  const name = asciiName(ctx.subject);
  const total = r.data.hits?.total?.value ?? null;
  const out: ParsedSource[] = [];
  if (total !== null) {
    const byForm = forms(r.data);
    const sentences = [`SEC EDGAR full-text search lists ${String(total)} filings that name ${name}.`];
    if (byForm.length > 0) sentences.push(`By form: ${byForm.map((f) => `${String(f.count)} ${f.form}`).join(", ")}.`);
    out.push({
      url: `https://www.sec.gov/edgar/search/#/q=%22${encodeURIComponent(name)}%22`,
      excerpt: clip(sentences.join(" ")),
      raw: { total, byForm },
      identity: "unverified",
    });
  }
  const seen = new Set<string>();
  const filings = (r.data.hits?.hits ?? [])
    .map((h) => ({ id: h._id ?? "", s: h._source ?? {} }))
    .filter((h) => h.id.includes(":"))
    .sort((a, b) => (b.s.file_date ?? "").localeCompare(a.s.file_date ?? ""));
  for (const h of filings) {
    const [accession = "", ...rest] = h.id.split(":");
    const file = rest.join(":");
    const cik = (h.s.ciks?.[0] ?? "").replace(/^0+/, "");
    if (accession === "" || file === "" || cik === "" || seen.has(accession)) continue;
    seen.add(accession);
    const form = h.s.form_type ?? h.s.root_forms?.[0] ?? "unknown form";
    const filer = (h.s.display_names ?? []).join(" and ");
    const date = h.s.file_date ?? "";
    const desc = h.s.file_description ?? "";
    const named = `Named in SEC filing ${form}${date === "" ? "" : ` filed ${date}`}${filer === "" ? "" : ` by ${filer}`}.`;
    const parts = [named];
    if (desc !== "") parts.push(`Document: ${desc}.`);
    parts.push(`The filing text names ${name}.`);
    out.push({
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replaceAll("-", "")}/${file}`,
      excerpt: clip(parts.join(" ")),
      raw: h,
      identity: "unverified",
    });
    if (seen.size >= MAX_FILINGS) break;
  }
  return out;
}

export const secEdgar: Collector = {
  id: "rest/sec-edgar",
  requests: (ctx): CollectorRequest[] => {
    const name = asciiName(ctx.subject);
    if (name.split(" ").length < 2) return [];
    return [
      {
        via: "fetch",
        url: `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(name)}%22`,
        init: {
          headers: { "user-agent": "oldboys-hackathon/0.1 (+https://oldboys.asajj.cz)", accept: "application/json" },
        },
      },
    ];
  },
  skipReason: (ctx) => (asciiName(ctx.subject).split(" ").length < 2 ? "name has no surname to search" : null),
  parse: (payload, ctx) => parsedSources(payload, ctx),
  digest: (fetched) => {
    const r = Payload.safeParse(fetched[0]?.payload ?? null);
    if (!r.success) return null;
    const filings = new Set((r.data.hits?.hits ?? []).map((h) => (h._id ?? "").split(":")[0] ?? "").filter((a) => a !== ""));
    return { total: r.data.hits?.total?.value ?? 0, byForm: forms(r.data), filings: Math.min(filings.size, MAX_FILINGS) };
  },
};
