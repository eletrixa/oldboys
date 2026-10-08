/**
 * Tests for htmlToText: tags stripped, block breaks kept as newlines, entities decoded, whitespace collapsed.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/html-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover the html-to-text contract shared by the email and StartupJobs intake connectors
 *
 * Design constraints:
 * - Pure input/output assertions, no fixtures on disk
 */
import { describe, expect, it } from "vitest";
import { htmlToText } from "../html-text";

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
