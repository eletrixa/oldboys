/**
 * Tests for the interview calendar invite: RFC 5545 structure, UTC times, TEXT escaping, 75-octet folding, description.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/runs/[id]/__tests__/interview-invite.test.ts
 * Deps:    vitest
 * Tested:  n/a (test file)
 *
 * Key responsibilities:
 * - interviewInvite: null without a brief; line order; CRLF only; UID, DTSTAMP, DTSTART/DTEND in UTC; SUMMARY with
 *   and without role; escaping of , ; \ and newlines; folding at 75 octets safe for Czech diacritics
 * - Description: summary lines, numbered questions (cap 8), to-verify (cap 5), brief URL, footer; never also_found
 *   or unconfirmed / rejected candidates
 * - inviteFileName: run id prefix only
 *
 * Design constraints:
 * - Pure: no React, no fetch; synthetic people only
 */
import { describe, expect, it } from "vitest";
import type { Brief, Candidate } from "@/domain/claim";
import type { RunState } from "../state";
import { interviewInvite, inviteFileName } from "../interview-invite";
import { summary30s } from "../summary";

const BRIEF_URL = "https://oldboys.example/runs/0123456789abcdef";
const START = new Date("2026-10-12T08:00:00.000Z");
const NOW = new Date("2026-10-09T01:02:03.456Z");

const cand = (platform: string, decision: Candidate["decision"], url: string, id = `${platform}-${decision}`): Candidate => ({
  id, run_id: "r", name: "Jan Novak", profile_urls: [url], anchor_match: null, score: 0.8, decision, platform, handle: null, snippet: "", reasons: [],
});

const brief = (over: Partial<Brief> = {}): Brief => ({
  run_id: "r",
  per_question: [
    { question_id: "mh-sql", coverage: "evidenced", claim_ids: ["c1"], summary: "SQL in two projects." },
    { question_id: "mh-lead", coverage: "none", claim_ids: [], summary: "" },
  ],
  interview_questions: ["Walk me through the pipeline you built at Acme?"],
  to_verify: ["Dates at Acme"],
  not_searched: [{ source: "x_profile", reason: "no confirmed handle" }],
  searched_empty: [],
  removed_protected: 0,
  degraded: null,
  evidence: [{ step: "rest/github", url: "https://github.com/jnovak", excerpt: "jnovak: 12 repositories" }],
  also_found: [{ step: "apify/google-search-scraper", url: "https://www.instagram.com/someone", excerpt: "Another Jan Novak" }],
  headline: "Senior Data Engineer at Acme",
  location_note: null,
  sections: [],
  ...over,
});

const run = (over: Partial<RunState> = {}): RunState => ({
  id: "0123456789abcdef",
  subject: "Jan Novak",
  headline: null,
  role: "Senior Data Engineer",
  organization_name: null,
  created_at: "2026-10-08T21:00:00.000Z",
  status: "done",
  step: null,
  mentions: 0,
  candidates: [
    cand("github", "merge", "https://github.com/jnovak"),
    cand("tiktok", "possibly-same-as", "https://www.tiktok.com/@jn-unconfirmed"),
    cand("youtube", "rejected", "https://www.youtube.com/@jn-rejected"),
  ],
  claims: [],
  sources: [],
  questions: [
    { id: "mh-sql", text: "Writes production SQL" },
    { id: "mh-lead", text: "Has led a team of at least three engineers" },
  ],
  brief: brief(),
  failure: null,
  intake: null,
  failed_step: null,
  step_index: 10,
  step_count: 10,
  cost: { usd: 0, source_calls: 0, llm_calls: 0, duration_ms: 0 },
  ...over,
});

const invite = (state: RunState = run(), minutes = 60): string =>
  interviewInvite(state, { start: START, minutes, briefUrl: BRIEF_URL, now: NOW }) ?? "";

/** Physical lines (CRLF-split, the empty tail after the final CRLF dropped). */
const physical = (ics: string): string[] => ics.split("\r\n").slice(0, -1);

/** Logical content lines: unfolded (CRLF + space removed). */
const logical = (ics: string): string[] => physical(ics.replace(/\r\n /g, ""));

const prop = (ics: string, name: string): string => logical(ics).find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1) ?? "";

/** Reverses RFC 5545 TEXT escaping. */
const unescape = (text: string): string => text.replace(/\\([\\;,nN])/g, (_m, c: string) => (c === "n" || c === "N" ? "\n" : c));

describe("interviewInvite", () => {
  it("returns null while there is no brief", () => {
    expect(interviewInvite(run({ brief: null }), { start: START, minutes: 60, briefUrl: BRIEF_URL, now: NOW })).toBeNull();
  });

  it("VCALENDAR/VEVENT structure and order, CRLF only, ends with CRLF, UTC times", () => {
    const ics = invite(run(), 45);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(/(^|[^\r])\n/.test(ics)).toBe(false);
    expect(logical(ics).map((l) => /^[A-Z-]+/.exec(l)?.[0])).toEqual([
      "BEGIN", "VERSION", "PRODID", "CALSCALE", "METHOD", "BEGIN", "UID", "DTSTAMP", "DTSTART", "DTEND",
      "SUMMARY", "URL", "DESCRIPTION", "END", "END",
    ]);
    const l = logical(ics);
    expect(l.slice(0, 6)).toEqual([
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//oldboys//interview invite//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    ]);
    expect(l.slice(-2)).toEqual(["END:VEVENT", "END:VCALENDAR"]);
    expect(prop(ics, "UID")).toBe("interview-0123456789abcdef@oldboys.asajj.cz");
    expect(prop(ics, "DTSTAMP")).toBe("20261009T010203Z");
    expect(prop(ics, "DTSTART")).toBe("20261012T080000Z");
    expect(prop(ics, "DTEND")).toBe("20261012T084500Z");
    expect(prop(ics, "URL")).toBe(BRIEF_URL);
    expect(ics).not.toMatch(/ATTENDEE|ORGANIZER/);
  });

  it("SUMMARY with and without a role", () => {
    expect(prop(invite(), "SUMMARY")).toBe("Interview: Jan Novak for Senior Data Engineer");
    expect(prop(invite(run({ role: null })), "SUMMARY")).toBe("Interview: Jan Novak");
  });

  it("escapes backslash, semicolon, comma and newlines in TEXT values", () => {
    const ics = invite(run({
      role: "Data, Platform; Ops \\ Lead",
      brief: brief({ interview_questions: ["First line, part; two\nsecond \\ line?"] }),
    }));
    expect(prop(ics, "SUMMARY")).toBe("Interview: Jan Novak for Data\\, Platform\\; Ops \\\\ Lead");
    const desc = prop(ics, "DESCRIPTION");
    expect(desc).toContain("1. First line\\, part\\; two\\nsecond \\\\ line?");
    expect(unescape(desc)).toContain("1. First line, part; two\nsecond \\ line?");
  });

  it("folds every physical line at 75 octets, unfolding restores the line, never splits a Czech character", () => {
    const czech = "Popište, jak jste vedl(a) migraci datového skladu: příliš žluťoučký kůň úpěl ďábelské ódy. ".repeat(6);
    const ics = invite(run({ role: "Vedoucí týmu datového inženýrství – Praha, Brno", brief: brief({ interview_questions: [czech] }) }));
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const lines = physical(ics);
    expect(lines.length).toBeGreaterThan(logical(ics).length);
    for (const line of lines) {
      const bytes = new TextEncoder().encode(line);
      expect(bytes.length).toBeLessThanOrEqual(75);
      expect(() => decoder.decode(bytes)).not.toThrow();
      expect(line).not.toContain("�");
    }
    expect(unescape(prop(ics, "DESCRIPTION"))).toContain(`1. ${czech.trim()}`);
    expect(unescape(prop(ics, "SUMMARY"))).toBe("Interview: Jan Novak for Vedoucí týmu datového inženýrství – Praha, Brno");
  });

  it("description: summary lines, numbered questions (cap 8), to-verify (cap 5), brief URL, footer; no namesakes", () => {
    const state = run({
      brief: brief({
        interview_questions: Array.from({ length: 10 }, (_, i) => `Question ${String(i + 1)}?`),
        to_verify: Array.from({ length: 7 }, (_, i) => `Check ${String(i + 1)}`),
      }),
    });
    const s = summary30s(state);
    const ics = invite(state);
    const desc = unescape(prop(ics, "DESCRIPTION"));
    expect(desc.split("\n")).toEqual([
      s?.documented, s?.missing, s?.ask,
      "", "Questions for the interview:", ...Array.from({ length: 8 }, (_, i) => `${String(i + 1)}. Question ${String(i + 1)}?`),
      "", "To verify:", ...Array.from({ length: 5 }, (_, i) => `- Check ${String(i + 1)}`),
      "", `Full brief with sources: ${BRIEF_URL}`,
      "This invite rates the research, not the candidate. Run data is deleted after 2026-10-15.",
    ]);
    const flat = ics.replace(/\r\n /g, "");
    for (const url of ["instagram.com/someone", "Another Jan Novak", "tiktok.com/@jn-unconfirmed", "youtube.com/@jn-rejected", "12 repositories"]) {
      expect(flat).not.toContain(url);
    }
  });

  it("omits the to-verify block when empty and the date clause when created_at does not parse", () => {
    const desc = unescape(prop(invite(run({ created_at: "", brief: brief({ to_verify: [] }) })), "DESCRIPTION"));
    expect(desc).not.toContain("To verify:");
    expect(desc.split("\n").at(-1)).toBe("This invite rates the research, not the candidate.");
  });
});

describe("inviteFileName", () => {
  it("uses the run id prefix only, never the name", () => {
    expect(inviteFileName(run())).toBe("interview-01234567.ics");
    expect(inviteFileName(run())).not.toMatch(/novak/i);
  });
});
