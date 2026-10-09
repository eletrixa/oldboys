/**
 * Privacy notice for one apply link: who decides, what is collected, what never is, why, how long, and the candidate's rights.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/privacy/page.tsx
 * Deps:    next, ../position (loadPosition), ../apply-copy (toLang, Lang), src/domain/audit (RETENTION_DAYS), src/app/ui
 * Tested:  n/a (static copy; the retention constant is the purge's, src/workflow/__tests__/purge.test.ts)
 *
 * Key responsibilities:
 * - The notice the apply page's privacy line links to, in English or Czech (`?lang=cs`), naming the employer when the tag has one
 * - Honest about the public professional information read for the interview, and about what is never looked for
 *
 * Design constraints:
 * - Candidate-facing: plain words, no product name, no emoji; retention from RETENTION_DAYS (src/domain/audit.ts)
 * - Same legal basis as the audit record (Art. 6(1)(f), src/domain/audit.ts) plus pre-contract steps (Art. 6(1)(b))
 * - Unknown or invalid tag is a 404, like the apply page
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eyebrow, LINK } from "@/app/ui";
import { RETENTION_DAYS } from "@/domain/audit";
import { toLang, type Lang } from "../apply-copy";
import { loadPosition } from "../position";

export const dynamic = "force-dynamic";

const DAYS = String(RETENTION_DAYS);

/** Close a sentence that may end in a company name like "Acme s.r.o." without doubling the period. */
const period = (text: string): string => (text.endsWith(".") ? text : `${text}.`);

type Notice = {
  eyebrow: string;
  title: string;
  forRole: (role: string, company: string | null) => string;
  sections: (company: string | null) => { heading: string; body: string }[];
  back: string;
};

const NOTICE: Record<Lang, Notice> = {
  en: {
    eyebrow: "Privacy notice",
    title: "How we handle your application",
    forRole: (role, company) => period(company === null ? `For the ${role} position` : `For the ${role} position at ${company}`),
    sections: (company) => [
      {
        heading: "Who decides",
        body: `${company ?? "The company hiring for this role"} decides how your application is used. This page and the storage behind it are run on their behalf by a hiring service provider.`,
      },
      {
        heading: "What we collect",
        body: "What you send us: your name, email, LinkedIn profile, CV and message. To prepare for your interview we also read public professional information about you, such as your LinkedIn profile and your public work online.",
      },
      {
        heading: "What we never do",
        body: "We do not look for or record health, political, religious or similar sensitive details, and we do not score your personality. No decision is made by software alone: a person reads every application.",
      },
      {
        heading: "Why",
        body: "Only to assess your application for this role. The legal basis is the steps you asked for before a possible employment contract (GDPR Art. 6(1)(b)) and our legitimate interest in checking the public professional record you point us to (Art. 6(1)(f)).",
      },
      { heading: "How long", body: `Everything is deleted from this service ${DAYS} days after we receive it. You can ask for earlier deletion at any time.` },
      {
        heading: "Your rights",
        body: "You can ask to see, correct or delete your data, or object to its use, by replying to any email we send you about this application. You can also complain to the Czech data protection authority, ÚOOÚ (uoou.gov.cz).",
      },
    ],
    back: "Back to the application",
  },
  cs: {
    eyebrow: "Ochrana osobních údajů",
    title: "Jak nakládáme s vaší přihláškou",
    forRole: (role, company) => period(company === null ? `Pozice ${role}` : `Pozice ${role}, ${company}`),
    sections: (company) => [
      {
        heading: "Kdo rozhoduje",
        body: `${company ?? "Firma, která na tuto pozici hledá,"} rozhoduje o tom, jak se vaše přihláška použije. Tuto stránku a úložiště za ní pro ni provozuje poskytovatel náborových služeb.`,
      },
      {
        heading: "Co shromažďujeme",
        body: "To, co nám pošlete: jméno, e-mail, profil na LinkedInu, životopis a zprávu. Abychom se připravili na pohovor, čteme také veřejné profesní informace o vás, například váš profil na LinkedInu a vaši veřejnou práci na internetu.",
      },
      {
        heading: "Co nikdy neděláme",
        body: "Nehledáme ani nezaznamenáváme údaje o zdraví, politických názorech, náboženství ani jiné citlivé údaje a nehodnotíme vaši osobnost. Žádné rozhodnutí nedělá jen software: každou přihlášku čte člověk.",
      },
      {
        heading: "Proč",
        body: "Jen abychom posoudili vaši přihlášku na tuto pozici. Právním základem jsou kroky před případným uzavřením pracovní smlouvy, o které jste požádali (čl. 6 odst. 1 písm. b) GDPR), a náš oprávněný zájem ověřit veřejné profesní údaje, na které nás odkazujete (čl. 6 odst. 1 písm. f)).",
      },
      { heading: "Jak dlouho", body: `Vše z této služby smažeme ${DAYS} dní poté, co přihlášku přijmeme. O dřívější smazání můžete kdykoli požádat.` },
      {
        heading: "Vaše práva",
        body: "Můžete požádat o přístup ke svým údajům, jejich opravu nebo smazání, nebo vznést námitku, a to odpovědí na kterýkoli e-mail, který vám k této přihlášce pošleme. Stížnost můžete podat také u Úřadu pro ochranu osobních údajů (uoou.gov.cz).",
      },
    ],
    back: "Zpět na přihlášku",
  },
};

type Props = { params: Promise<{ tag: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const notice = NOTICE[toLang((await searchParams).lang)];
  return { title: notice.title, robots: { index: false } };
}

export default async function PrivacyPage({ params, searchParams }: Props): Promise<React.JSX.Element> {
  const [{ tag }, query] = await Promise.all([params, searchParams]);
  const position = await loadPosition(tag);
  if (position === null) notFound();
  const lang = toLang(query.lang);
  const notice = NOTICE[lang];

  return (
    <main lang={lang} className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12 md:py-16">
      <header className="flex flex-col gap-3">
        <Eyebrow>{notice.eyebrow}</Eyebrow>
        <h1 className="text-4xl leading-[1.1]">{notice.title}</h1>
        <p className="text-lg text-muted">{notice.forRole(position.role, position.company)}</p>
      </header>
      {notice.sections(position.company).map((s) => (
        <section key={s.heading} className="flex flex-col gap-1.5">
          <h2 className="text-xl">{s.heading}</h2>
          <p className="max-w-[62ch] leading-relaxed text-ink">{s.body}</p>
        </section>
      ))}
      <a href={lang === "en" ? `/apply/${position.tag}` : `/apply/${position.tag}?lang=${lang}`} className={`${LINK} inline-flex min-h-11 items-center self-start`}>
        {notice.back}
      </a>
    </main>
  );
}
