/**
 * Tests for htmlToText (intake) and htmlPageText / mentionWindows / pageExcerpt (read web pages).
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/html-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover the html-to-text contract shared by the email and StartupJobs intake connectors
 * - Cover page text, verbatim mention windows (diacritics both ways, merging, cap) and the excerpt fallback of rest/read-pages
 *
 * Design constraints:
 * - Pure input/output assertions, no fixtures on disk
 */
import { describe, expect, it } from "vitest";
import { htmlPageText, htmlToText, mentionWindows, pageExcerpt } from "../html-text";

describe("htmlToText", () => {
  it("strips tags and collapses inline whitespace", () => {
    expect(htmlToText("<div><b>Hello</b>   <i>world</i>\t!</div>")).toBe("Hello world !");
  });

  it("keeps block breaks as single newlines and drops blank runs", () => {
    expect(htmlToText("<p>one</p><p>two<br>three</p>\n\n\n<div>four</div>")).toBe("one\ntwo\nthree\nfour");
  });

  it("decodes the named entities once, never twice", () => {
    expect(htmlToText("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; f&nbsp;g &amp;lt;")).toBe(`a & b <c> "d" 'e' f g &lt;`);
  });

  it("decodes numeric entities, including Czech letters", () => {
    expect(htmlToText("&#381;ivotopis &#x161;ance")).toBe("Životopis šance");
  });

  it("drops script, style and head content and HTML comments", () => {
    expect(htmlToText("<head><title>T</title><style>p{}</style></head><script>x()</script><!-- c --><p>body</p>")).toBe("body");
  });

  it("returns an empty string for empty or tag-only input", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText("<br><p></p>")).toBe("");
  });
});

describe("htmlToText on hostile input", () => {
  it("unclosed comments, scripts and tags stay linear (1 MB in well under a second)", () => {
    const hostile = "<!--<script<a<".repeat(80_000);
    const started = performance.now();
    htmlToText(hostile);
    htmlToText("<".repeat(1_000_000));
    htmlToText("<script>".repeat(120_000));
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("an unclosed comment or script drops the rest, as a browser would", () => {
    expect(htmlToText("<p>keep</p><!-- open <p>gone</p>")).toBe("keep");
    expect(htmlToText("<p>keep</p><script>gone")).toBe("keep");
  });
});

describe("htmlPageText", () => {
  it("drops page chrome and scripts, keeps block breaks and one blank line at most", () => {
    const html = `<html><head><title>Board &amp; team</title><script>track()</script></head><body>
      <header>Site menu</header><nav><a href="/">Home</a></nav><noscript>enable js</noscript><svg><text>logo</text></svg>
      <article><h1>Jana Dvo&#345;&#225;kov&#xE1;</h1><p>Leads data.</p><br><br><br><p>Joined in 2021.</p></article>
      <aside>Ads</aside><footer>&copy; 2026</footer><!-- hidden --></body></html>`;
    const page = htmlPageText(html);
    expect(page.title).toBe("Board & team");
    expect(page.text).not.toMatch(/Site menu|Home|enable js|logo|Ads|track|hidden|2026/);
    expect(page.text).toContain("Leads data.");
    expect(page.text).not.toMatch(/\n{3,}/);
    expect(page.text.startsWith("Jana Dvo")).toBe(true);
  });

  it("decodes entities and falls back to og:title", () => {
    const page = htmlPageText(`<meta content="Profil &quot;J&quot;" property="og:title"><p>a &lt;b&gt; &#381;ivot &#x161;ance&nbsp;x</p>`);
    expect(page.title).toBe('Profil "J"');
    expect(page.text).toBe("a <b> Život šance x");
    expect(htmlPageText("<p>x</p>").title).toBe("");
  });

  it("stays linear on unclosed elements", () => {
    const started = performance.now();
    htmlPageText("<nav<title<meta ".repeat(60_000));
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("mentionWindows", () => {
  const filler = (n: number): string => "Lorem ipsum dolor sit amet. ".repeat(n);

  it("matches diacritics-insensitively both ways and keeps the original text verbatim", () => {
    const text = `${filler(30)}Dušan Senkypl spoke at the summit.\n${filler(30)}`;
    const [w] = mentionWindows(text, ["Šenkypl"]);
    expect(w).toContain("Dušan Senkypl spoke at the summit.");
    expect(text).toContain(w);
    const back = mentionWindows("Interview with Dusan Šenkypl, founder.", ["Senkypl"]);
    expect(back).toEqual(["Interview with Dusan Šenkypl, founder."]);
  });

  it("is whole-word and case-insensitive", () => {
    expect(mentionWindows("The novakova street.", ["Novák"])).toEqual([]);
    expect(mentionWindows("NOVÁK said yes.", ["novak"])).toEqual(["NOVÁK said yes."]);
  });

  it("snaps windows to sentence boundaries and merges overlapping ones", () => {
    const text = `${filler(40)}First Novák line. Second Novák line. ${filler(40)}`;
    const windows = mentionWindows(text, ["Novák"], { window: 60 });
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatch(/^Lorem ipsum.*First Novák line\. Second Novák line\..*amet\.$/s);
  });

  it("returns separate windows in document order, at most max", () => {
    const text = ["Novák one.", "Novák two.", "Novák three."].join(filler(40));
    const windows = mentionWindows(text, ["Novák"], { window: 50, max: 2 });
    expect(windows).toHaveLength(2);
    expect(windows[0]).toContain("Novák one.");
    expect(windows[1]).toContain("Novák two.");
  });

  it("matches a full name across a line break", () => {
    expect(mentionWindows("By Jana\nDvořáková", ["Jana Dvořáková"])).toEqual(["By Jana\nDvořáková"]);
  });
});

describe("pageExcerpt", () => {
  it("puts the title first and joins windows with an ellipsis line", () => {
    const text = ["Novák one.", "Novák two."].join(" Lorem ipsum dolor sit amet.".repeat(40));
    const out = pageExcerpt({ title: "T", text }, ["Novák"], 6000);
    expect(out.startsWith("T\n")).toBe(true);
    expect(out).toContain("\n…\n");
  });

  it("falls back to the lead text when nothing matches, and clips to max", () => {
    const text = "x".repeat(3000);
    expect(pageExcerpt({ title: "T", text }, ["Novák"], 6000)).toBe(`T\n${"x".repeat(1500)}`);
    const clipped = pageExcerpt({ title: "", text }, ["Novák"], 100);
    expect(clipped).toHaveLength(100);
    expect(clipped.endsWith("…")).toBe(true);
  });
});
