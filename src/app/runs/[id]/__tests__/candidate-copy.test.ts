/**
 * Tests for the candidate notice Markdown: content, degraded brief, no brief, escaping, exclusions and file name.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/candidate-copy.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - candidateCopy: null without a brief; role, sources searched / not searched, confirmed links, deletion date, rights
 * - Never claims, summaries, interview questions, to-verify items, cost, excerpts or also_found hits
 * - Model text is escaped and non-http links are dropped
 * - Czech notice (lang "cs"): headings, greeting without the name, role sentences, Czech date, translated labels and
 *   known reasons, unknown reasons passed through scrubbed, same exclusions
 * - noticeFileName: run id prefix only, "-cs" suffix for the Czech notice
 *
 * Design constraints:
 * - Pure: no React, no fetch
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate, Claim } from "@/domain/claim";
import { candidateCopy, noticeFileName } from "../candidate-copy";
import type { RunState } from "../state";

const claim: Claim = {
  id: "c1", run_id: "r", question_id: "mh-exp", candidate_id: null, text: "Works at Acme since 2021", kind: "FACT",
  confidence: 0.9, quote: "q", supports: ["s1"], contradicts: [], rank: 0,
};

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: "k1", run_id: "r", name: "Jan Novak", profile_urls: ["https://www.linkedin.com/in/jnovak"], anchor_match: "Prague",
  score: 0.9, decision: "merge", platform: "linkedin", handle: "jnovak", snippet: "Data Engineer, Prague", reasons: ["city match"],
  ...over,
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  profile: null,
  run_id: "r",
  per_question: [{ question_id: "mh-exp", coverage: "evidenced", claim_ids: ["c1"], summary: "Five years of data work." }],
  interview_questions: ["Walk me through your last pipeline."],
  to_verify: ["Dates at Acme"],
  not_searched: [{ source: "facebook_profile", reason: "profile not opened (login needed); only search snippets were read" }],
  searched_empty: [{ source: "github_profile", reason: "no public repositories" }],
  removed_protected: 1,
  degraded: null,
  evidence: [{ step: "rest/x", url: "https://x.com/jnovak", excerpt: "jnovak posts about Spark" }],
  also_found: [{ step: "apify/google-search-scraper", url: "https://namesake.example/jan", excerpt: "Another Jan Novak, dentist" }],
  headline: "Senior Data Engineer at Acme",
  location_note: "Confirmed profile mentions Brno, you entered Prague",
  sections: [],
  ...over,
});

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "0123456789abcdef",
  subject: "Jan Novak",
  headline: null,
  role: "Senior Data Engineer",
  position: null,
  organization_name: null,
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [candidate(), candidate({ id: "k2", decision: "possibly-same-as", platform: "instagram", profile_urls: ["https://instagram.com/other"] })],
  claims: [claim],
  sources: [{ id: "s1", url: "https://www.linkedin.com/in/jnovak" }],
  questions: [{ id: "mh-exp", text: "Has five years of data engineering" }],
  brief: brief(),
  failure: null,
  intake: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0.234, source_calls: 7, llm_calls: 4, duration_ms: 192_000 },
  ...over,
});

const notice = (over: Partial<RunState> = {}): string => candidateCopy(run(over)) ?? "";

/** Text that must never reach the candidate, whatever the brief looks like. */
const FORBIDDEN = [
  "Works at Acme", "Five years of data work", "Walk me through", "Dates at Acme", "Senior Data Engineer at Acme",
  "Brno", "posts about Spark", "namesake.example", "dentist", "instagram.com/other", "$0.23", "0.234", "protected categories",
];

describe("candidateCopy", () => {
  it("returns null while there is no brief", () => {
    expect(candidateCopy(run({ brief: null }))).toBeNull();
  });

  it("says who, why, which sources, which links, the deletion date and how to object", () => {
    const md = notice();
    expect(md).toContain("Hello Jan Novak,");
    expect(md).toContain("the Senior Data Engineer role");
    expect(md).toContain("never rates you");
    expect(md).toContain("- LinkedIn\n");
    expect(md).toContain("- X\n");
    expect(md).toContain("- GitHub (nothing found that we could confirm as yours)");
    expect(md).toContain("- Facebook: profile not opened (login needed); only search snippets were read");
    expect(md).toContain("- <https://www.linkedin.com/in/jnovak>");
    expect(md).toContain("- <https://x.com/jnovak>");
    expect(md).toContain("deleted on 2026-10-15");
    expect(md).toContain("or earlier, as soon as you are no longer considered for the role");
    expect(md).toContain("Reply to this email");
    const order = [
      "## Why",
      "## Public sources we searched",
      "## Sources we did not search, and why",
      "## Public profiles and pages we confirmed as yours",
      "## How long we keep it",
      "## Your rights",
    ].map((h) => md.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("never includes claims, summaries, questions, cost, excerpts or unconfirmed namesake hits", () => {
    for (const degraded of [null, "model timeout"]) {
      const md = notice({ brief: brief({ degraded }) });
      for (const text of FORBIDDEN) expect(md).not.toContain(text);
    }
  });

  it("degraded brief: same notice, links from confirmed evidence, no model note", () => {
    const md = notice({ candidates: [], brief: brief({ degraded: "model timeout" }) });
    expect(md).not.toContain("model timeout");
    expect(md).toContain("- <https://x.com/jnovak>");
    expect(md).not.toContain("linkedin.com");
    expect(md).toContain("## Your rights");
  });

  it("names the recruiter's organization in the text and sign-off", () => {
    const md = notice({ organization_name: "Acme s.r.o." });
    expect(md).toContain("the hiring team at Acme s.r.o.");
    expect(md).toContain("The hiring team at Acme s.r.o.");
    expect(md).not.toContain("our hiring team");
  });

  it("keeps the anonymous wording without an organization", () => {
    const md = notice({ organization_name: null });
    expect(md).toContain("our hiring team");
    expect(md).toContain("The hiring team\n");
  });

  it("nothing confirmed and no role: plain fallbacks, empty lists leave no heading", () => {
    const md = notice({
      role: null,
      candidates: [],
      brief: brief({ evidence: [], not_searched: [], searched_empty: [] }),
    });
    expect(md).toContain("the role you applied for");
    expect(md).toContain("We did not confirm any public profile as yours.");
    expect(md).not.toContain("## Public sources we searched");
    expect(md).not.toContain("## Sources we did not search");
  });

  it("escapes subject, role and gap text and drops non-http links", () => {
    const md = notice({
      subject: "**Jan** [x](javascript:alert(1))",
      role: "# Lead\nEngineer",
      candidates: [candidate({ profile_urls: ["https://www.linkedin.com/in/jnovak"] })],
      brief: brief({
        evidence: [{ step: "s", url: "javascript:alert(1)", excerpt: "e" }],
        not_searched: [{ source: "x_profile", reason: "<b>no</b> handle" }],
      }),
    });
    expect(md).toContain("Hello \\*\\*Jan\\*\\* \\[x\\](javascript:alert(1)),");
    expect(md).toContain("the \\# Lead Engineer role");
    expect(md).toContain("- X: \\<b\\>no\\</b\\> handle");
    expect(md).not.toContain("<javascript:");
    expect(md).not.toMatch(/[^\\]\]\(javascript:/);
  });

  it("scrubs URLs and e-mails out of not-searched reasons", () => {
    const md = notice({
      brief: brief({
        not_searched: [
          {
            source: "openalex_author",
            reason: "lookup at https://api.openalex.org/authors?search=Jan%20Novak&mailto=ops@example.org timed out, ask hr@example.com",
          },
        ],
      }),
    });
    expect(md).toContain("- OpenAlex: lookup at api.openalex.org timed out, ask (email)");
    for (const leak of ["search=", "Jan%20Novak", "mailto", "ops@example.org", "hr@example.com"]) expect(md).not.toContain(leak);
  });

  it("falls back to the plain 7-day wording when created_at does not parse", () => {
    expect(notice({ created_at: "yesterday" })).toContain("deleted 7 days after the research");
  });
});

const cs = (over: Partial<RunState> = {}): string => candidateCopy(run(over), "cs") ?? "";

describe("candidateCopy (cs)", () => {
  it("returns null while there is no brief", () => {
    expect(candidateCopy(run({ brief: null }), "cs")).toBeNull();
  });

  it("Czech headings in order, no English fixed text, greeting without the name", () => {
    const md = cs();
    expect(md.startsWith("# Jak jsme se podívali na Vaše veřejné profily\n\nDobrý den,\n")).toBe(true);
    expect(md).not.toContain("Jan Novak");
    const order = [
      "## Proč",
      "## Co průzkum dělá a co ne",
      "## Veřejné zdroje, které jsme prohledali",
      "## Zdroje, které jsme neprohledali, a proč",
      "## Veřejné profily a stránky, které jsme potvrdili jako Vaše",
      "## Jak dlouho údaje uchováváme",
      "## Vaše práva",
    ].map((h) => md.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const en of ["How we looked", "## Why", "Your rights", "Hello", "Public sources", "Kind regards", "Reply to this email", "nothing found"]) {
      expect(md).not.toContain(en);
    }
    expect(md).toContain("Nikdy nehodnotí Vás jako člověka.");
    expect(md.endsWith("Stačí odpovědět na tento e-mail.\n\nS pozdravem  \nnáborový tým\n")).toBe(true);
  });

  it("role and no-role sentences", () => {
    const md = cs();
    expect(md).toContain("děkujeme za Váš zájem o pozici Senior Data Engineer. V rámci výběrového řízení");
    expect(md).toContain("Obsazujeme pozici Senior Data Engineer. Průzkum nám pomáhá");
    const none = cs({ role: "  " });
    expect(none).toContain("děkujeme za Váš zájem o nabízenou pozici. V rámci");
    expect(none).toContain("Obsazujeme nabízenou pozici. Průzkum");
  });

  it("Czech deletion date, and the plain sentence when the date is unknown", () => {
    expect(cs()).toContain("Všechna data z průzkumu smažeme 15. 10. 2026 (7 dní po průzkumu), nebo dříve, jakmile už ve výběrovém řízení nebudete pokračovat.");
    expect(cs({ created_at: "2026-01-01T08:00:00.000Z" })).toContain("smažeme 8. 1. 2026 (7 dní");
    expect(cs({ created_at: "yesterday" })).toContain("Všechna data z průzkumu smažeme 7 dní po průzkumu, nebo dříve,");
  });

  it("translates generic labels, keeps platform names, marks searched-empty sources", () => {
    const md = cs({
      candidates: [candidate(), candidate({ id: "k3", platform: "web", profile_urls: ["https://jan.example/about"] })],
      brief: brief({
        searched_empty: [
          { source: "github_profile", reason: "no public repositories" },
          { source: "personal_site_crawl", reason: "nothing" },
          { source: "talks_serp", reason: "nothing" },
          { source: "social_serp", reason: "nothing" },
        ],
      }),
    });
    expect(md).toContain("- LinkedIn\n");
    expect(md).toContain("- X\n");
    expect(md).toContain("- Vyhledávání na webu\n");
    expect(md).toContain("- GitHub (nenašli jsme nic, co bychom mohli potvrdit jako Vaše)");
    expect(md).toContain("- Osobní web (nenašli jsme nic, co bychom mohli potvrdit jako Vaše)");
    expect(md).toContain("- Přednášky a příspěvky (nenašli jsme nic");
    expect(md).toContain("- Hledání profilů na sociálních sítích (nenašli jsme nic");
  });

  it("translates known reasons, keeps the HTTP code, passes unknown reasons through scrubbed", () => {
    const md = cs({
      brief: brief({
        not_searched: [
          { source: "facebook_profile", reason: "profile not opened (login needed); only search snippets were read" },
          { source: "x_profile", reason: "request failed: HTTP 429 from https://api.example.com/x?q=Jan%20Novak" },
          { source: "github_profile", reason: "request failed: timeout" },
          { source: "instagram_profile", reason: "no confirmed handle or id to look up" },
          { source: "tiktok_profile", reason: "run budget reached" },
          { source: "youtube_channel", reason: "no reason recorded" },
          { source: "bluesky_profile", reason: "run budget reached; request failed: HTTP 503" },
          { source: "serp_person", reason: "quota hit" },
          {
            source: "openalex_author",
            reason: "lookup at https://api.openalex.org/authors?search=Jan%20Novak&mailto=ops@example.org timed out, ask hr@example.com",
          },
        ],
      }),
    });
    expect(md).toContain("- Facebook: profil jsme neotevřeli (vyžaduje přihlášení); četli jsme jen úryvky z výsledků vyhledávání\n");
    expect(md).toContain("- X: služba odmítla náš dotaz (HTTP 429)\n");
    expect(md).toContain("- GitHub: služba neodpověděla\n");
    expect(md).toContain("- Instagram: neměli jsme potvrzený profil, který bychom mohli dohledat\n");
    expect(md).toContain("- TikTok: vyčerpal se rozpočet průzkumu\n");
    expect(md).toContain("- YouTube: důvod nebyl zaznamenán\n");
    expect(md).toContain("- Bluesky: vyčerpal se rozpočet průzkumu; služba odmítla náš dotaz (HTTP 503)\n");
    expect(md).toContain("- Vyhledávání na webu: quota hit\n");
    expect(md).toContain("- OpenAlex: lookup at api.openalex.org timed out, ask (email)\n");
    for (const leak of ["search=", "Jan%20Novak", "mailto", "ops@example.org", "hr@example.com", "api.example.com/x"]) expect(md).not.toContain(leak);
  });

  it("never includes claims, summaries, questions, cost, excerpts or namesake hits; links only http(s)", () => {
    for (const degraded of [null, "model timeout"]) {
      const md = cs({ brief: brief({ degraded }) });
      for (const text of FORBIDDEN) expect(md).not.toContain(text);
      expect(md).not.toContain("model timeout");
    }
    const md = cs({ brief: brief({ evidence: [{ step: "s", url: "javascript:alert(1)", excerpt: "e" }] }) });
    expect(md).toContain("- <https://www.linkedin.com/in/jnovak>");
    expect(md).not.toContain("javascript:");
    expect(cs({ candidates: [], brief: brief({ evidence: [] }) })).toContain("Žádný veřejný profil jsme jako Váš nepotvrdili.");
  });

  it("escapes the role", () => {
    expect(cs({ role: "# Lead\nEngineer" })).toContain("o pozici \\# Lead Engineer.");
  });
});

describe("noticeFileName", () => {
  it("adds -cs for the Czech notice", () => {
    expect(noticeFileName(run(), "en")).toBe("candidate-notice-01234567.md");
    expect(noticeFileName(run(), "cs")).toBe("candidate-notice-01234567-cs.md");
  });

  it("uses the run id prefix, never the subject's name", () => {
    const name = noticeFileName(run());
    expect(name).toBe("candidate-notice-01234567.md");
    expect(name.toLowerCase()).not.toContain("novak");
  });
});
