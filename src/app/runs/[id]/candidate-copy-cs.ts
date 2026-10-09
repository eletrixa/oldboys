/**
 * Czech texts of the candidate notice (idea #24, part): fixed strings, generic source labels and known gap reasons.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/candidate-copy-cs.ts
 * Deps:    ./candidate-copy (NoticeText type), ./state (gapText)
 * Tested:  src/app/runs/[id]/__tests__/candidate-copy.test.ts
 *
 * Key responsibilities:
 * - CS_TEXT: the notice in formal ("Vy"), gender-neutral Czech; no name in the greeting (Czech needs the vocative)
 * - Generic source labels ("Web search", "Personal website" …) in Czech; platform names stay as they are
 * - Known "not searched" reasons in Czech; unknown reasons pass through unchanged
 * - Deletion line matches the English one: the date, or earlier once the candidate no longer continues in the selection
 *
 * Design constraints:
 * - Pure strings only; escaping, links and scrubbing stay in candidate-copy.ts
 * - Reasons arrive already scrubbed; "; "-joined collector notes are translated part by part
 */
import type { NoticeText } from "./candidate-copy";
import { gapText } from "./state";

/** Generic English labels from GAP_LABEL / evidenceGroup; platform names (LinkedIn, GitHub, ORCID …) are not listed. */
const LABEL_CS: Record<string, string> = {
  "Web search": "Vyhledávání na webu",
  "Social profile search": "Hledání profilů na sociálních sítích",
  "Personal website": "Osobní web",
  "Talks and posts": "Přednášky a příspěvky",
  "Press and awards search": "Hledání v médiích a oceněních",
  "LinkedIn posts": "Příspěvky na LinkedIn",
  "Employer company page": "Firemní stránka zaměstnavatele",
  "Facebook page": "Stránka na Facebooku",
  CV: "Životopis",
};

/** Reasons in plain words (after gapText) that can reach brief.not_searched: runner notes, budget gate, synthesize. */
const REASON_CS: Record<string, string> = {
  "the service did not answer": "služba neodpověděla",
  "no confirmed profile to look up": "neměli jsme potvrzený profil, který bychom mohli dohledat",
  "run budget reached": "vyčerpal se rozpočet průzkumu",
  "no reason recorded": "důvod nebyl zaznamenán",
  "already fetched at seed": "profil jsme načetli už na začátku průzkumu",
};

const REFUSED = /^the service refused our request \(HTTP (\d{3})\)$/;

/** One reason in plain words → Czech, or null when it is not a known one. */
function knownReason(plain: string): string | null {
  const code = REFUSED.exec(plain)?.[1];
  if (code !== undefined) return `služba odmítla náš dotaz (HTTP ${code})`;
  return REASON_CS[plain] ?? null;
}

/** A scrubbed reason in Czech: the whole text first, then each "; " part; unknown parts stay as gapText left them. */
function reasonCs(scrubbed: string): string {
  const whole = knownReason(gapText(scrubbed));
  if (whole !== null) return whole;
  return scrubbed
    .split("; ")
    .map((part) => {
      const plain = gapText(part);
      return knownReason(plain) ?? plain;
    })
    .join("; ");
}

/** "2026-10-15" → "15. 10. 2026" (no leading zeros). */
function dateCs(isoDay: string): string {
  const [y = "", m = "", d = ""] = isoDay.split("-");
  return `${String(Number(d))}. ${String(Number(m))}. ${y}`;
}

export const CS_TEXT: NoticeText = {
  title: "Jak jsme se podívali na Vaše veřejné profily",
  greeting: () => "Dobrý den,",
  intro: (role, org) =>
    `děkujeme za Váš zájem ${role !== null ? `o pozici ${role}` : "o nabízenou pozici"}. V rámci výběrového řízení se ` +
    `${org !== null ? `náborový tým společnosti ${org}` : "náš tým"} podíval na veřejné informace o Vás. Chceme Vám říct, na co jsme se dívali a proč.`,
  whyHeading: "Proč",
  why: (role) =>
    `${role !== null ? `Obsazujeme pozici ${role}.` : "Obsazujeme nabízenou pozici."} Průzkum nám pomáhá připravit dobré otázky ` +
    "na pohovor a zjistit, které části Vaší veřejné práce souvisejí s pozicí.",
  doesHeading: "Co průzkum dělá a co ne",
  does: (org) => [
    "- Používá jen veřejné zdroje. Žádné soukromé zprávy, uzavřené skupiny ani přihlašování.",
    "- Hodnotí samotný průzkum: kolik veřejných dokladů našel a jak jsou kvalitní. Nikdy nehodnotí Vás jako člověka.",
    "- Nezabývá se zdravím, politickými názory, náboženstvím, etnickým původem, sexuální orientací ani podobnými citlivými tématy.",
    `- Průzkum sám nic nerozhoduje; každé rozhodnutí dělají lidé ${org !== null ? `ze společnosti ${org}` : "z našeho týmu"}.`,
  ],
  searchedHeading: "Veřejné zdroje, které jsme prohledali",
  emptySuffix: "(nenašli jsme nic, co bychom mohli potvrdit jako Vaše)",
  notSearchedHeading: "Zdroje, které jsme neprohledali, a proč",
  confirmedHeading: "Veřejné profily a stránky, které jsme potvrdili jako Vaše",
  noneConfirmed: "Žádný veřejný profil jsme jako Váš nepotvrdili.",
  notYou: "Pokud některý z nich nepatří Vám, dejte nám prosím vědět a odstraníme ho.",
  keepHeading: "Jak dlouho údaje uchováváme",
  keep: (day, days) =>
    day !== null
      ? `Všechna data z průzkumu smažeme ${dateCs(day)} (${String(days)} dní po průzkumu), nebo dříve, jakmile už ve výběrovém řízení nebudete pokračovat.`
      : `Všechna data z průzkumu smažeme ${String(days)} dní po průzkumu, nebo dříve, jakmile už ve výběrovém řízení nebudete pokračovat.`,
  rightsHeading: "Vaše práva",
  rights: "Můžete se nás zeptat, co jsme našli, požádat o opravu nebo o okamžité smazání.",
  reply: "Stačí odpovědět na tento e-mail.",
  closing: (org) => ["S pozdravem  ", org !== null ? `náborový tým společnosti ${org}` : "náborový tým"],
  label: (label) => LABEL_CS[label] ?? label,
  reason: reasonCs,
};
