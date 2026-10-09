/**
 * Czech public registries: which registry checks a position triggers, and the digest the `cz_registries` step writes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/cz-registry.ts
 * Deps:    zod, src/domain/ledger-digest (readDigest)
 * Tested:  src/domain/__tests__/cz-registry.test.ts
 *
 * Key responsibilities:
 * - `REGISTRIES`: the catalog (id, name, public search page, scope, access: `fetch` = the collector queries it, `manual` = CAPTCHA or
 *   signed access only, so the report links the search page for a hand check: Medical Chamber, ČNB, court experts, vets). `everyone` registries run for every position
 *   (insolvency register, ARES business records, Police wanted list, public register persons); `role` registries run when the
 *   role title names the licensed profession (doctors, dentists, pharmacists, lawyers, architects, construction engineers,
 *   tax advisors, auditors, financial intermediaries, bailiffs, notaries, court experts and interpreters, veterinarians)
 * - `registriesFor(role)`: everyone + the role-matched ones, in catalog order; `registryById`
 * - `RegistryCheck` / `RegistryChecks`: one row per registry queried (clear / hits / namesakes / unavailable), what was searched,
 *   hits with the registry's own wording, a link and `match` (why the record is the candidate's: city or company), the count of
 *   records under the name set aside as namesakes; the digest the collector writes into its ledger ref and `readRegistryChecks` reads back
 * - `townOf`, `redactHitLabel`, `redactRegistryExcerpt`: a registry address shrinks to its town (no street, house number, postcode);
 *   collectors use `townOf` when they build hit lines, the readers redact digests and excerpts stored before that
 * - `REGISTRY_CAVEATS`: the fixed honesty lines (name-only search, namesakes, a hit is never a judgment)
 *
 * Design constraints:
 * - Pure, no I/O. A hit is attributed by the candidate's city or employers (the collector decides), never by name alone; the digest
 *   says "a record under this name at the candidate's city exists", never "the candidate is insolvent". No Art. 9 data; nothing here scores the person
 * - "architect" alone never triggers the architects' chamber: software / solution / cloud / data / enterprise architects are excluded
 */
import { z } from "zod";
import { type LedgerRow, readDigest } from "./ledger-digest";

export const REGISTRY_IDS = [
  "isir",
  "ares",
  "justice-or",
  "police",
  "clk",
  "csk",
  "clnk",
  "cak",
  "nrpzs",
  "cka",
  "ckait",
  "kdp",
  "kacr",
  "cnb",
  "ekcr",
  "nkcr",
  "znalci",
  "kvl",
] as const;
export const RegistryId = z.enum(REGISTRY_IDS);
export type RegistryId = z.infer<typeof RegistryId>;

export type Registry = {
  id: RegistryId;
  /** English name shown in the report. */
  name: string;
  /** Czech name of the registry (the source's own name). */
  name_cs: string;
  /** Public search page a reader can open. */
  url: string;
  /** Who it is checked for: every position, or positions whose role title matches `role`. */
  scope: "everyone" | "role";
  /** Lower-cased role title regex (CZ + EN); undefined for `everyone`. */
  role?: RegExp;
  /** `fetch`: the collector queries it; `manual`: no public endpoint a Worker may use (CAPTCHA, signed access), the report links the search page for a hand check. */
  access: "fetch" | "manual";
  /** One line: what a hit means for a recruiter. */
  means: string;
};

const NOT_BUILDING_ARCHITECT = /(software|solution|solutions|cloud|data|enterprise|system|systems|it|security|network|platform|ai|ml|technical)\s+architect/;

export const REGISTRIES: readonly Registry[] = [
  { id: "isir", name: "Insolvency register", name_cs: "Insolvenční rejstřík (ISIR)", url: "https://isir.justice.cz/isir/common/index.do", scope: "everyone", access: "fetch", means: "an insolvency proceeding was filed against a person of this name (past or current)" },
  { id: "ares", name: "ARES business records", name_cs: "ARES — ekonomické subjekty", url: "https://ares.gov.cz/ekonomicke-subjekty", scope: "everyone", access: "fetch", means: "a sole trader or business is registered under this name (side business, conflict of interest to ask about)" },
  { id: "justice-or", name: "Public register persons", name_cs: "Veřejný rejstřík — osoby", url: "https://or.justice.cz/ias/ui/rejstrik-$osoba", scope: "everyone", access: "fetch", means: "a person of this name sits in a statutory body or owns a registered company" },
  { id: "police", name: "Police wanted and missing persons", name_cs: "Policie ČR — pátrání po osobách", url: "https://policie.gov.cz/patrani-osoby", scope: "everyone", access: "fetch", means: "a person of this name is on the public wanted or missing list" },
  { id: "clk", name: "Czech Medical Chamber", name_cs: "Česká lékařská komora", url: "https://www.lkcr.cz/seznam-lekaru", scope: "role", role: /l[eé]ka[rř]|doctor|physician|mudr|medical|chirurg|surgeon|psychiatr|pediatr|intern(ist|í)/, access: "manual", means: "licence to practise medicine in the Czech Republic (a doctor absent here cannot practise)" },
  { id: "nrpzs", name: "National register of health-care providers", name_cs: "Národní registr poskytovatelů zdravotních služeb (NRPZS)", url: "https://nrpzs.uzis.cz/index.php?pg=vyhledavani-poskytovatele--pro-verejnost", scope: "role", role: /l[eé]ka[rř]|doctor|physician|mudr|mddr|medical|chirurg|surgeon|psychiatr|pediatr|intern(ist|í)|zubn|dentist|stomatolog|dental|fyzioterap|physiother|zdravotn|nurse|sestra|psycholog|logoped|nutri/, access: "fetch", means: "a licensed health-care provider (practice) is registered under this name with its field of care (employed clinicians do not appear)" },
  { id: "csk", name: "Czech Dental Chamber", name_cs: "Česká stomatologická komora", url: "https://www.dent.cz/seznam-zubnich-lekaru", scope: "role", role: /zubn|dentist|stomatolog|dental|mddr/, access: "fetch", means: "licence to practise dentistry" },
  { id: "clnk", name: "Czech Chamber of Pharmacists", name_cs: "Česká lékárnická komora", url: "https://www.lekarnici.cz/", scope: "role", role: /l[eé]k[aá]rn|pharmac|farmaceut|pharmd/, access: "fetch", means: "licence to practise pharmacy" },
  { id: "cak", name: "Czech Bar Association", name_cs: "Česká advokátní komora", url: "https://vyhledavac.cak.cz/", scope: "role", role: /advok|lawyer|attorney|\bpr[aá]vn[ií](k|\b)|legal|counsel|koncipient|solicitor|barrister/, access: "fetch", means: "entry as an attorney or trainee attorney, with status (active, suspended, struck off)" },
  { id: "cka", name: "Czech Chamber of Architects", name_cs: "Česká komora architektů", url: "https://www.cka.cz/cs/svet-architektury/seznam-architektu", scope: "role", role: /architekt|architect|urbanist|krajin[aá]ř/, access: "fetch", means: "authorisation as an architect (required to sign building designs)" },
  { id: "ckait", name: "Chamber of Chartered Engineers in Construction", name_cs: "ČKAIT — autorizovaní inženýři a technici", url: "https://www.ckait.cz/expert-search", scope: "role", role: /stavb|stavební|civil engineer|structural|statik|autorizovan|construction|building engineer|site manager|stavbyvedouc|projektant|hvac|tzb/, access: "fetch", means: "authorisation in construction (statics, site management, building design)" },
  { id: "kdp", name: "Chamber of Tax Advisers", name_cs: "Komora daňových poradců", url: "https://www.kdpcr.cz/seznam-danovych-poradcu", scope: "role", role: /da[nň]ov|tax adviser|tax advisor|tax consultant|tax manager|tax specialist/, access: "fetch", means: "registration as a tax adviser (protected title)" },
  { id: "kacr", name: "Chamber of Auditors", name_cs: "Komora auditorů ČR", url: "https://www.kacr.cz/seznam-auditoru", scope: "role", role: /\bauditor|\baudit\b|statutory audit|účetní expert/, access: "fetch", means: "registration as a statutory auditor" },
  { id: "cnb", name: "Czech National Bank supervised persons", name_cs: "ČNB — seznamy regulovaných subjektů", url: "https://www.cnb.cz/cs/dohled-financni-trh/seznamy/", scope: "role", role: /finan[cč]n[ií] (poradc|zprostředkov)|financial advis|insurance|pojiš|investment advis|investi[cč]n|broker|makl[eé]|wealth|bank(er|ing) advis|mortgage|hypote/, access: "manual", means: "registration as a financial, insurance or investment intermediary" },
  { id: "ekcr", name: "Chamber of Bailiffs", name_cs: "Exekutorská komora ČR", url: "https://www.ekcr.cz/seznam-exekutoru", scope: "role", role: /exeku|bailiff|enforcement officer/, access: "fetch", means: "appointment as a court bailiff" },
  { id: "nkcr", name: "Chamber of Notaries", name_cs: "Notářská komora ČR", url: "https://www.nkcr.cz/seznam-notaru", scope: "role", role: /not[aá][rř]|notary/, access: "fetch", means: "appointment as a notary" },
  { id: "znalci", name: "Court experts and interpreters", name_cs: "Seznam znalců a tlumočníků", url: "https://seznat.justice.cz/", scope: "role", role: /znalec|znalk|expert witness|tlumo[cč]|p[rř]eklad|interpreter|translator|forensic|appraiser|odhadc/, access: "manual", means: "entry as a court-appointed expert, interpreter or translator" },
  { id: "kvl", name: "Chamber of Veterinary Surgeons", name_cs: "Komora veterinárních lékařů", url: "https://www.vetkom.cz/seznam-veterinaru", scope: "role", role: /veterin|mvdr/, access: "manual", means: "licence to practise veterinary medicine" },
];

export function registryById(id: RegistryId): Registry {
  const r = REGISTRIES.find((x) => x.id === id);
  if (r === undefined) throw new Error(`unknown registry ${id}`);
  return r;
}

/** Every `everyone` registry plus the `role` ones whose pattern matches the role title; catalog order. */
export function registriesFor(role: string | null): Registry[] {
  const t = (role ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return REGISTRIES.filter((r) => {
    if (r.scope === "everyone") return true;
    if (t === "" || r.role?.test(t) !== true) return false;
    return !(r.id === "cka" && NOT_BUILDING_ARCHITECT.test(t) && !/\b(building|stavebn|krajin|urban)/.test(t));
  });
}

export const RegistryHit = z.object({
  /** The registry's own line for the record (name as listed, place, status, evidence number ...). */
  label: z.string().min(1),
  /** Link to the record or to the search that shows it. */
  url: z.string().min(1),
  /** Registry's own status word when it has one (e.g. "aktivní", "pozastaveno", "ukončeno"); null otherwise. */
  status: z.string().nullable().default(null),
  /** Birth date or year when the registry lists one; null otherwise. */
  born: z.string().nullable().default(null),
  /** Why the record is the candidate's and not a namesake's ("city: Brno", "company: Snuggs"); null when only the name matches. */
  match: z.string().nullable().default(null),
});
export type RegistryHit = z.infer<typeof RegistryHit>;

export const RegistryCheck = z.object({
  registry: RegistryId,
  /**
   * clear: searched, no record under the name; hits: records attributed to the candidate (or, without a known city, every record
   * under the name); namesakes: records under the name exist but none is at the candidate's city or employers; unavailable: no answer.
   */
  status: z.enum(["clear", "hits", "namesakes", "unavailable"]),
  /** What was typed into the registry's search (name, birth date, city). */
  searched: z.string().min(1),
  /** The search page or API call that answered; a reader can repeat it. */
  source_url: z.string().min(1),
  hits: z.array(RegistryHit).default([]),
  /** Records under the name set aside because their city or company is not the candidate's (not listed in `hits`). */
  namesakes: z.number().int().nonnegative().default(0),
  /** Total the registry reported when it exceeds the listed hits; null when unknown. */
  total: z.number().int().nonnegative().nullable().default(null),
  /** Error text or registry notice for `unavailable`; null otherwise. */
  note: z.string().nullable().default(null),
});
export type RegistryCheck = z.infer<typeof RegistryCheck>;

export const RegistryChecks = z.object({
  subject: z.string().min(1),
  /** Role title the role-scoped registries were chosen from; null without a role. */
  role: z.string().nullable().default(null),
  checks: z.array(RegistryCheck),
});
export type RegistryChecks = z.infer<typeof RegistryChecks>;

export const REGISTRY_STEP = "cz_registries";

/** Czech postcode ("186 00", "18600", "PSČ 186 00"); never inside an 8-digit IČO. */
const POSTCODE = /(?:PSČ\s*)?(?<!\d)\d{3} ?\d{2}(?!\d)/u;
/** Trailing house number ("77", "620/3", "č. p. 12") after a street or village name. */
const HOUSE_NUMBER = /(?:^|\s+)(?:č\.\s?p\.\s*)?\d+[a-z]?(?:\/\d+[a-z]?)?$/iu;

/**
 * The municipality of a registry address, never the street, house number or postcode: "Hrachov 77, 262 56 Svatý Jan" -> "Svatý Jan",
 * "Dlouhá 12/4, 110 00 Praha 1" -> "Praha 1", "Ostrožská Lhota 120" -> "Ostrožská Lhota", "Svatý Jan - Hrachov 77, okres Příbram, PSČ 26256" -> "Svatý Jan". null when no town can be told apart.
 */
export function townOf(address: string | null | undefined): string | null {
  const parts = (address ?? "").split(",").map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p !== "");
  for (const p of [...parts].reverse()) {
    const m = POSTCODE.exec(p);
    const after = m === null ? "" : p.slice(m.index + m[0].length).trim();
    if (after !== "") return after;
  }
  // Older public-register form "Svatý Jan - Hrachov 77, okres Příbram, PSČ 26256": the town leads, before " - "
  const first = parts[0] ?? "";
  const dash = first.indexOf(" - ");
  const pick = dash > 0 ? first.slice(0, dash) : (parts.filter((p) => !POSTCODE.test(p) && !/^okres\b/iu.test(p)).at(-1) ?? "");
  const town = pick.replace(HOUSE_NUMBER, "").trim();
  return town === "" || /\d/.test(town) ? null : town;
}

const NO_TOWN = "town not listed";

/**
 * A hit line with any third person's address cut to the town (stored digests from before the collectors did it themselves).
 * ARES "— IČO …, <seat>, since", public register "<name>, <address> — …", dental chamber "…, <workplace address>", notaries and
 * health-care providers ", <postcode> <town>".
 */
export function redactHitLabel(registry: RegistryId, label: string): string {
  let out = label;
  if (registry === "ares") out = out.replace(/^(.*? — IČO [^,]*, )(.*?)(, since .*)$/u, (_m, a: string, addr: string, b: string) => `${a}${townOf(addr) ?? NO_TOWN}${b}`);
  if (registry === "justice-or") out = out.replace(/^([^—,]*), (.*?)( — .*)$/u, (_m, a: string, addr: string, b: string) => `${a}, ${townOf(addr) ?? NO_TOWN}${b}`);
  if (registry === "csk") out = out.replace(/^(.*?member of the Czech Dental Chamber), (.*)$/u, (_m, a: string, addr: string) => `${a}, ${townOf(addr) ?? NO_TOWN}`);
  // Notaries and health-care providers list "<postcode> <town>" (file numbers elsewhere look like postcodes, so only here)
  return registry === "nkcr" || registry === "nrpzs" ? out.replace(new RegExp(`${POSTCODE.source}\\s+(?=\\p{L})`, "gu"), "") : out;
}

/** A `rest/cz-registries` source excerpt with every listed hit line redacted like `redactHitLabel` (other excerpts unchanged). */
export function redactRegistryExcerpt(excerpt: string): string {
  const r = REGISTRIES.find((x) => excerpt.startsWith(`${x.name} (${x.name_cs})`));
  if (r === undefined) return excerpt;
  return excerpt
    .split("\n")
    .map((line) => (line.startsWith("- ") ? `- ${redactHitLabel(r.id, line.slice(2))}` : line))
    .join("\n");
}

/** The latest digest, hit lines without street, house number or postcode (a namesake's home address never leaves the server). */
export function readRegistryChecks(rows: readonly LedgerRow[]): RegistryChecks | null {
  const d = readDigest(rows, REGISTRY_STEP, RegistryChecks);
  if (d === null) return null;
  return { ...d, checks: d.checks.map((c) => ({ ...c, hits: c.hits.map((h) => ({ ...h, label: redactHitLabel(c.registry, h.label) })) })) };
}

export const REGISTRY_CAVEATS: readonly string[] = [
  "Searches are by name only (no birth number or birth date). A record is listed as the candidate's when its city or company matches the profile; records under the name elsewhere are counted as namesakes and left out. Confirm at the interview, never assume.",
  "A clear result means no record under this exact spelling on the day of the search; registries lag and spellings vary.",
  "A chamber entry shows the licence exists; its absence for a role that needs one is a question to ask, not a verdict.",
  "Nothing here is a score of the person; it is the registry's own wording with a link.",
];
