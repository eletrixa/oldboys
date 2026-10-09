/**
 * Every candidate-facing sentence of the apply page in English and Czech: page, fields, CV uploader, sending, done card,
 * privacy line and the validation sentences the server answers with.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/apply-copy.ts
 * Deps:    src/domain/application (CV_MAX, CV_MAX_BYTES), src/domain/audit (RETENTION_DAYS), src/domain/cv-kind (CvKind)
 * Tested:  src/app/apply/[tag]/__tests__/apply-fields.test.ts (both languages carry the same keys, toLang, messages in use)
 *
 * Key responsibilities:
 * - `Lang` ("en" default, "cs" for the Jobs.cz ad: `/apply/<tag>?lang=cs`), `toLang` for any raw value
 * - `COPY[lang]`: page and widget copy; `COPY[lang].messages`: the sentences `checkApply` and the handler return
 *
 * Design constraints:
 * - Pure data and small formatters; no DOM, so the server handler and the client bundle share it
 * - Calm, short, no emoji, never mentions research, scoring or runs; the retention matches src/workflow/purge.ts
 */
import { CV_MAX, CV_MAX_BYTES } from "@/domain/application";
import { RETENTION_DAYS } from "@/domain/audit";
import type { CvKind } from "@/domain/cv-kind";

export type Lang = "en" | "cs";

/** "cs" when asked for Czech, English for anything else (missing, unknown, an array from a repeated query param). */
export function toLang(raw: unknown): Lang {
  return raw === "cs" ? "cs" : "en";
}

const MB = String(CV_MAX_BYTES / (1024 * 1024));
const DAYS = String(RETENTION_DAYS);

type ReadableKind = Exclude<CvKind, "doc">;

const EN = {
  page: {
    eyebrow: "Apply",
    atCompany: (company: string): string => `at ${company}`,
    intro: "Send us your LinkedIn profile or CV. We read every application and reply by email.",
    title: (role: string, company: string | null): string => (company === null ? `Apply: ${role}` : `Apply: ${role} at ${company}`),
    description: "Send us your LinkedIn profile or CV. We reply by email.",
    other: { lang: "cs" as Lang, label: "Česky" },
  },
  form: {
    label: "Apply",
    name: "Full name",
    email: "Email",
    linkedin: "LinkedIn profile",
    optional: "(optional)",
    linkedinHint: "Add your LinkedIn profile, your CV, or both. One is enough.",
    linkedinPlaceholder: "linkedin.com/in/your-name",
    cv: "CV",
    message: "Message",
    send: "Send application",
    sending: "Sending…",
    tryAgain: "Try again",
  },
  cv: {
    zone: "Choose a file or drop it here",
    zoneSub: "From your computer or phone",
    zoneReplace: "A new file replaces the one below",
    formats: `PDF, Word or text file, up to ${MB} MB.`,
    kind: { pdf: "PDF", docx: "Word document", txt: "Text file", doc: "Older Word document" } satisfies Record<CvKind, string>,
    unknownKind: "File",
    remove: "Remove",
    removeLabel: (name: string): string => `Remove ${name}`,
    multiDrop: (name: string): string => `Only one file can be attached, so we took ${name}.`,
    docNote: "We keep older Word (.doc) files but cannot read them, so we need your LinkedIn profile too. A PDF or .docx works on its own.",
    pasteToggle: "No file at hand? Paste your CV text",
    fileToggle: "Attach a file instead",
    pasteLabel: "Your CV as text",
    pastePlaceholder: "Paste the text of your CV here",
    count: (n: number): string => `${n.toLocaleString("en")} of ${CV_MAX.toLocaleString("en")} characters`,
  },
  progress: {
    label: "Sending your application",
    uploading: (percent: number): string => `Uploading ${String(percent)}%`,
    checkingCv: "Checking your CV",
    checkingDetails: "Checking your details",
  },
  done: {
    heading: (email: string): string => `Received. We'll reply to ${email}.`,
    cvFile: (name: string): string => `Your CV: ${name}`,
    cvPasted: "Your CV, pasted as text",
    linkedin: "Your LinkedIn profile",
    andLinkedin: ", and your LinkedIn profile",
    horizon: "We usually reply within a week.",
    close: "You can close this page.",
  },
  privacy: {
    line: (company: string | null): string =>
      `${company ?? "The hiring company"} uses what you send only for this application and deletes it from this service after ${DAYS} days.`,
    link: "Privacy notice",
    newTab: "(opens in a new tab)",
  },
  messages: {
    name: "Please enter your full name.",
    email: "Please enter a valid email address.",
    linkedin: "That does not look like a LinkedIn profile link. It should look like linkedin.com/in/your-name.",
    linkedinOrCv: "Please add your LinkedIn profile, attach your CV or paste it.",
    cvType: "Please attach your CV as a PDF, Word or text file.",
    cvSize: `Your CV is larger than ${MB} MB. Please attach a smaller file or paste the text.`,
    cvEmpty: "That file is empty. Please attach your CV again.",
    cvText: `Your pasted CV is longer than ${CV_MAX.toLocaleString("en")} characters. Please shorten it or attach the file.`,
    cvDoc: "We cannot read older Word (.doc) files. Please add your LinkedIn profile too, or attach the CV as PDF or .docx.",
    cvUnreadable: {
      pdf: "We could not read any text in that PDF. Please add your LinkedIn profile or paste the text of your CV.",
      docx: "We could not read any text in that Word file. Please add your LinkedIn profile or paste the text of your CV.",
      txt: "We could not read any text in that file. Please add your LinkedIn profile or paste the text of your CV.",
    } satisfies Record<ReadableKind, string>,
    refusedType: (picked: string, kept: string): string => `${picked} was not added: please use a PDF, Word or text file. ${kept} is still attached.`,
    refusedSize: (picked: string, kept: string): string => `${picked} was not added: it is larger than ${MB} MB. ${kept} is still attached.`,
    refusedEmpty: (picked: string, kept: string): string => `${picked} was not added: the file is empty. ${kept} is still attached.`,
    message: "Your message is too long. Please shorten it.",
    tag: "This position link is not valid.",
    unreadableForm: "We could not read that form. Please reload the page and try again.",
    check: "Please check your details and try again.",
    server: "We could not send your application. Please try again in a moment.",
    offline: "We could not reach the service. Please check your connection and try again.",
    timeout: "This is taking longer than it should. Please check your connection and try again.",
  },
};

export type ApplyCopy = typeof EN;

const CS: ApplyCopy = {
  page: {
    eyebrow: "Přihláška",
    atCompany: (company) => `ve firmě ${company}`,
    intro: "Pošlete nám svůj profil na LinkedInu nebo životopis. Každou přihlášku čteme a odpovídáme e-mailem.",
    title: (role, company) => (company === null ? `Přihláška: ${role}` : `Přihláška: ${role}, ${company}`),
    description: "Pošlete nám profil na LinkedInu nebo životopis. Odpovíme e-mailem.",
    other: { lang: "en", label: "English" },
  },
  form: {
    label: "Přihláška",
    name: "Jméno a příjmení",
    email: "E-mail",
    linkedin: "Profil na LinkedInu",
    optional: "(nepovinné)",
    linkedinHint: "Přidejte profil na LinkedInu, životopis, nebo obojí. Stačí jedno.",
    linkedinPlaceholder: "linkedin.com/in/vase-jmeno",
    cv: "Životopis",
    message: "Zpráva",
    send: "Odeslat přihlášku",
    sending: "Odesíláme…",
    tryAgain: "Zkusit znovu",
  },
  cv: {
    zone: "Vyberte soubor nebo ho sem přetáhněte",
    zoneSub: "Z počítače nebo z telefonu",
    zoneReplace: "Nový soubor nahradí ten níže",
    formats: `PDF, Word nebo textový soubor, nejvýše ${MB} MB.`,
    kind: { pdf: "PDF", docx: "Dokument Word", txt: "Textový soubor", doc: "Starší dokument Word" },
    unknownKind: "Soubor",
    remove: "Odebrat",
    removeLabel: (name) => `Odebrat ${name}`,
    multiDrop: (name) => `Přiložit jde jen jeden soubor, vzali jsme ${name}.`,
    docNote: "Starší soubory Word (.doc) uložíme, ale neumíme je přečíst, takže potřebujeme i váš profil na LinkedInu. PDF nebo .docx stačí samo.",
    pasteToggle: "Nemáte soubor po ruce? Vložte text životopisu",
    fileToggle: "Raději přiložit soubor",
    pasteLabel: "Váš životopis jako text",
    pastePlaceholder: "Sem vložte text svého životopisu",
    count: (n) => `${n.toLocaleString("cs")} z ${CV_MAX.toLocaleString("cs")} znaků`,
  },
  progress: {
    label: "Odesíláme vaši přihlášku",
    uploading: (percent) => `Nahráváme ${String(percent)} %`,
    checkingCv: "Kontrolujeme váš životopis",
    checkingDetails: "Kontrolujeme vaše údaje",
  },
  done: {
    heading: (email) => `Přijato. Odpovíme na ${email}.`,
    cvFile: (name) => `Váš životopis: ${name}`,
    cvPasted: "Váš životopis, vložený jako text",
    linkedin: "Váš profil na LinkedInu",
    andLinkedin: " a váš profil na LinkedInu",
    horizon: "Obvykle odpovídáme do týdne.",
    close: "Tuto stránku teď můžete zavřít.",
  },
  privacy: {
    line: (company) =>
      `${company ?? "Firma, která na pozici hledá"} použije vaše údaje jen pro tuto přihlášku a po ${DAYS} dnech je z této služby smaže.`,
    link: "Ochrana osobních údajů",
    newTab: "(otevře se v nové záložce)",
  },
  messages: {
    name: "Vyplňte prosím jméno a příjmení.",
    email: "Zadejte prosím platnou e-mailovou adresu.",
    linkedin: "Tohle nevypadá jako odkaz na profil na LinkedInu. Měl by vypadat jako linkedin.com/in/vase-jmeno.",
    linkedinOrCv: "Přidejte prosím profil na LinkedInu, přiložte životopis, nebo ho vložte jako text.",
    cvType: "Přiložte prosím životopis jako PDF, dokument Word nebo textový soubor.",
    cvSize: `Životopis je větší než ${MB} MB. Přiložte prosím menší soubor, nebo vložte text.`,
    cvEmpty: "Ten soubor je prázdný. Přiložte prosím životopis znovu.",
    cvText: `Vložený životopis má víc než ${CV_MAX.toLocaleString("cs")} znaků. Zkraťte ho prosím, nebo přiložte soubor.`,
    cvDoc: "Starší soubory Word (.doc) neumíme přečíst. Přidejte prosím i profil na LinkedInu, nebo přiložte životopis jako PDF či .docx.",
    cvUnreadable: {
      pdf: "V tomto PDF jsme nenašli žádný text. Přidejte prosím profil na LinkedInu, nebo vložte text životopisu.",
      docx: "V tomto souboru Word jsme nenašli žádný text. Přidejte prosím profil na LinkedInu, nebo vložte text životopisu.",
      txt: "V tomto souboru jsme nenašli žádný čitelný text. Přidejte prosím profil na LinkedInu, nebo vložte text životopisu.",
    },
    refusedType: (picked, kept) => `Soubor ${picked} jsme nepřidali: použijte prosím PDF, Word nebo textový soubor. ${kept} zůstává přiložený.`,
    refusedSize: (picked, kept) => `Soubor ${picked} jsme nepřidali: je větší než ${MB} MB. ${kept} zůstává přiložený.`,
    refusedEmpty: (picked, kept) => `Soubor ${picked} jsme nepřidali: je prázdný. ${kept} zůstává přiložený.`,
    message: "Zpráva je příliš dlouhá. Zkraťte ji prosím.",
    tag: "Tento odkaz na pozici není platný.",
    unreadableForm: "Formulář se nepodařilo přečíst. Načtěte prosím stránku znovu a zkuste to ještě jednou.",
    check: "Zkontrolujte prosím své údaje a zkuste to znovu.",
    server: "Přihlášku se nepodařilo odeslat. Zkuste to prosím za chvíli znovu.",
    offline: "Nepodařilo se spojit se službou. Zkontrolujte prosím připojení a zkuste to znovu.",
    timeout: "Trvá to déle, než by mělo. Zkontrolujte prosím připojení a zkuste to znovu.",
  },
};

export const COPY: Readonly<Record<Lang, ApplyCopy>> = { en: EN, cs: CS };

export type ApplyMessages = ApplyCopy["messages"];
