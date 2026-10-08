/**
 * Tests for htmlToText.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/html-text.test.ts
 * Deps:    vitest
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - Cover tag stripping, entity decoding (without double decoding) and whitespace collapsing
 *
 * Design constraints:
 * - Pure string in, string out
 */
import { describe, expect, it } from "vitest";
import { htmlToText } from "../html-text";

describe("htmlToText", () => {
  it("strips tags and decodes the common entities", () => {
    expect(htmlToText("<p>Hello &amp; <b>wor</b>ld &lt;3 &quot;x&quot; it&#39;s&nbsp;fine &gt;</p>")).toBe(
      'Hello & world <3 "x" it\'s fine >',
    );
  });

  it("separates block elements and line breaks with a space and collapses whitespace", () => {
    expect(htmlToText("<p>One</p>\n\n<p>Two<br>Three</p>   <div>Four</div>")).toBe("One Two Three Four");
  });

  it("does not decode twice", () => {
    expect(htmlToText("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
  });

  it("returns an empty string for markup without text", () => {
    expect(htmlToText("<p> </p><br/>")).toBe("");
  });
});
