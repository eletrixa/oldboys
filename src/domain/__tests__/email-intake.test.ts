/**
 * Tests for the email intake parser: recipient split, LinkedIn URL, CV pick, sender allow-list, and four real .eml shapes.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/email-intake.test.ts
 * Deps:    vitest, postal-mime (the real parser, run under Node)
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover specs/intake/email.md helpers and parseIntakeMail over fixtures/*.eml
 *
 * Design constraints:
 * - Fixtures are hand-written with invented people; no module mocks
 */
import { readFileSync } from "node:fs";
import PostalMime from "postal-mime";
import { describe, expect, it } from "vitest";
import { IntakeInput } from "../application";
import { firstLinkedinUrl, parseIntakeMail, pickCv, senderAllowed, splitRecipient, type ParsedMail } from "../email-intake";

const fixture = (name: string): Buffer => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const parse = (name: string) => PostalMime.parse(fixture(name));
const RAW_ID = "f".repeat(64);

describe("splitRecipient", () => {
  it("lowercases and splits the plus tag", () => {
    expect(splitRecipient("Jobs+Senior-BE@asajj.cz")).toEqual({ local: "jobs", tag: "senior-be" });
  });
  it("no plus part means no tag", () => {
    expect(splitRecipient("jobs@asajj.cz")).toEqual({ local: "jobs", tag: null });
    expect(splitRecipient("jobs+@asajj.cz")).toEqual({ local: "jobs", tag: null });
  });
  it("handles the display-name form", () => {
    expect(splitRecipient('"Jobs" <jobs+qa-1@asajj.cz>')).toEqual({ local: "jobs", tag: "qa-1" });
  });
  it("returns other local parts unchanged for the recipient gate", () => {
    expect(splitRecipient("Info@asajj.cz")).toEqual({ local: "info", tag: null });
    expect(splitRecipient("jobsx+a@asajj.cz")).toEqual({ local: "jobsx", tag: "a" });
  });
});

describe("firstLinkedinUrl", () => {
  it("finds and normalises the first profile URL", () => {
    expect(firstLinkedinUrl("see https://cz.linkedin.com/in/Jana-Novak/?trk=x and linkedin.com/in/other")).toBe(
      "https://www.linkedin.com/in/jana-novak",
    );
  });
  it("accepts a bare host and strips trailing punctuation", () => {
    expect(firstLinkedinUrl("LinkedIn: www.linkedin.com/in/jana-novak.")).toBe("https://www.linkedin.com/in/jana-novak");
    expect(firstLinkedinUrl("(linkedin.com/in/jana-novak), thanks")).toBe("https://www.linkedin.com/in/jana-novak");
  });
  it("skips company pages and finds a profile after them", () => {
    expect(firstLinkedinUrl("https://www.linkedin.com/company/acme then https://linkedin.com/in/jan-k")).toBe(
      "https://www.linkedin.com/in/jan-k",
    );
  });
  it("finds a URL inside an href", () => {
    expect(firstLinkedinUrl('<a href="https://www.linkedin.com/in/jan-k">me</a>')).toBe("https://www.linkedin.com/in/jan-k");
  });
  it("null when there is none", () => {
    expect(firstLinkedinUrl("no profile here, linkedin.com/feed")).toBeNull();
  });
  it("stays linear on a hostile body (2 MB in well under a second)", () => {
    const started = performance.now();
    expect(firstLinkedinUrl("a.".repeat(1_000_000))).toBeNull();
    expect(firstLinkedinUrl("linkedin.com/in/".repeat(100_000))).toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("pickCv", () => {
  const bytes = (s: string) => new TextEncoder().encode(s);
  it("prefers a PDF by MIME type over an earlier text file", () => {
    const cv = pickCv([
      { filename: "photo.jpg", mimeType: "image/jpeg", content: bytes("img") },
      { filename: "notes.txt", mimeType: "text/plain", content: bytes("notes") },
      { filename: "CV.pdf", mimeType: "application/pdf", content: bytes("%PDF-1.4") },
    ]);
    expect(cv).toMatchObject({ filename: "CV.pdf", contentType: "application/pdf" });
    expect(new TextDecoder().decode(cv?.bytes)).toBe("%PDF-1.4");
    expect(cv?.bytes).toBeInstanceOf(ArrayBuffer);
  });
  it("recognises a PDF by its .pdf filename when the MIME type is generic", () => {
    expect(pickCv([{ filename: "cv.PDF", mimeType: "application/octet-stream", content: new ArrayBuffer(4) }])).toMatchObject({
      filename: "cv.PDF",
      contentType: "application/octet-stream",
    });
  });
  it("falls back to text/plain and encodes string content", () => {
    const cv = pickCv([{ filename: null, mimeType: "text/plain", content: "Jan K, Go engineer" }]);
    expect(cv).toMatchObject({ filename: "cv.txt", contentType: "text/plain" });
    expect(new TextDecoder().decode(cv?.bytes)).toBe("Jan K, Go engineer");
  });
  it("ignores images, documents and calendar parts", () => {
    expect(
      pickCv([
        { filename: "a.png", mimeType: "image/png", content: bytes("x") },
        { filename: "cv.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: bytes("x") },
      ]),
    ).toBeNull();
    expect(pickCv([])).toBeNull();
  });
});

describe("senderAllowed", () => {
  it("an empty or blank list allows anyone", () => {
    expect(senderAllowed("a@b.cz", "")).toBe(true);
    expect(senderAllowed(undefined, " , ")).toBe(true);
  });
  it("matches domains (and their subdomains) and full addresses, case-insensitively", () => {
    const list = "Jobs.cz, robert@soulfire.cz, @seznam.cz";
    expect(senderAllowed("noreply@JOBS.cz", list)).toBe(true);
    expect(senderAllowed("x@mailer.jobs.cz", list)).toBe(true);
    expect(senderAllowed("Robert@Soulfire.cz", list)).toBe(true);
    expect(senderAllowed("jana@seznam.cz", list)).toBe(true);
  });
  it("rejects anything else, look-alike domains and a missing sender", () => {
    const list = "jobs.cz,robert@soulfire.cz";
    expect(senderAllowed("other@soulfire.cz", list)).toBe(false);
    expect(senderAllowed("x@evil-jobs.cz", list)).toBe(false);
    expect(senderAllowed("x@jobs.cz.evil.com", list)).toBe(false);
    expect(senderAllowed(undefined, list)).toBe(false);
  });
});

describe("parseIntakeMail over fixtures", () => {
  it("gmail-forward: tag, sender, LinkedIn URL from the text body and the PDF attachment", async () => {
    const input = parseIntakeMail(await parse("gmail-forward.eml"), "jobs+senior-be@asajj.cz", RAW_ID);
    expect(input).toMatchObject({
      source: "email",
      externalId: "<CAF0xGmailFwd0001@mail.example.net>",
      tag: "senior-be",
      name: "Marek Lindner",
      email: "marek.lindner@example.net",
      linkedinUrl: "https://www.linkedin.com/in/marek-lindner-test",
      note: "subject: Application: Senior Backend Engineer",
      cv: { filename: "Marek Lindner CV.pdf", contentType: "application/pdf" },
    });
    expect(input.coverLetter).toMatch(/^Hello,\s+I would like to apply/);
    expect(new TextDecoder().decode(input.cv?.bytes.slice(0, 5))).toBe("%PDF-");
    expect(() => IntakeInput.parse(input)).not.toThrow();
  });

  it("seznam-copy: quoted-printable Czech text decoded, profile from the signature, no CV", async () => {
    const input = parseIntakeMail(await parse("seznam-copy.eml"), "jobs+senior-be@asajj.cz", RAW_ID);
    expect(input).toMatchObject({
      tag: "senior-be",
      name: "Jana Dvořáková",
      email: "jana.dvorakova@example.cz",
      linkedinUrl: "https://www.linkedin.com/in/jana-dvorakova-qa",
      note: "subject: Žádost o místo",
    });
    expect(input.cv).toBeUndefined();
    expect(input.coverLetter).toContain("Životopis pošlu");
  });

  it("jobs-cz-notification: HTML-only body becomes the cover letter, no profile, no CV", async () => {
    const input = parseIntakeMail(await parse("jobs-cz-notification.eml"), "jobs+senior-be@asajj.cz", RAW_ID);
    expect(input.linkedinUrl).toBeUndefined();
    expect(input.cv).toBeUndefined();
    expect(input.email).toBe("noreply@jobs.example");
    expect(input.coverLetter).toContain("Uchazeč: Petr Holeček");
    expect(input.coverLetter).toContain('"Senior Backend Engineer" & těším se');
    expect(input.coverLetter).not.toContain("<");
  });

  it("no-tag: no tag, and the raw hash is the externalId when there is no Message-ID", async () => {
    const input = parseIntakeMail(await parse("no-tag.eml"), "jobs@asajj.cz", RAW_ID);
    expect(input).toMatchObject({ tag: undefined, externalId: RAW_ID, linkedinUrl: "https://www.linkedin.com/in/ondrej-svoboda-dev" });
  });

  it("every fixture is at most 6 KB", () => {
    for (const f of ["gmail-forward.eml", "seznam-copy.eml", "jobs-cz-notification.eml", "no-tag.eml"]) {
      expect(fixture(f).byteLength).toBeLessThanOrEqual(6 * 1024);
    }
  });
});

describe("parseIntakeMail field limits", () => {
  const mail = (over: Partial<ParsedMail>): ParsedMail => ({ attachments: [], ...over });

  it("drops what IntakeInput would reject instead of throwing", () => {
    const input = parseIntakeMail(
      mail({ messageId: `<${"x".repeat(400)}@a>`, from: { name: "  ", address: "not an address" }, text: "   ", subject: "s".repeat(2000) }),
      "jobs+senior-be@asajj.cz",
      RAW_ID,
    );
    expect(input.externalId).toBe(RAW_ID);
    expect(input.name).toBeUndefined();
    expect(input.email).toBeUndefined();
    expect(input.coverLetter).toBeUndefined();
    expect(input.note).toHaveLength(1000);
    expect(() => IntakeInput.parse(input)).not.toThrow();
  });

  it("caps the cover letter at 10000 characters and the name at 200", () => {
    const input = parseIntakeMail(mail({ text: "a".repeat(12_000), from: { name: "N".repeat(300), address: "n@x.cz" } }), "jobs@asajj.cz", RAW_ID);
    expect(input.coverLetter).toHaveLength(10_000);
    expect(input.name).toHaveLength(200);
    expect(() => IntakeInput.parse(input)).not.toThrow();
  });

  it("a profile only in the HTML href is found", () => {
    const input = parseIntakeMail(mail({ text: "see my profile", html: '<a href="https://linkedin.com/in/jan-k">profile</a>' }), "jobs@asajj.cz", RAW_ID);
    expect(input.linkedinUrl).toBe("https://www.linkedin.com/in/jan-k");
  });
});
