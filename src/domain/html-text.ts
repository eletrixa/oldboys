/**
 * HTML fragment to plain text for cover letters and notification bodies.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/html-text.ts
 * Deps:    none
 * Tested:  src/domain/__tests__/html-text.test.ts
 *
 * Key responsibilities:
 * - `htmlToText`: strip tags, decode &amp; &lt; &gt; &quot; &#39; &nbsp;, collapse whitespace
 *
 * Design constraints:
 * - Not a sanitiser and never rendered as HTML: the result is stored and shown as text only
 * - Block tags and <br> become a space so adjacent paragraphs do not glue together
 */
const BLOCK_TAG = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|table|blockquote)\b[^>]*>/gi;

export function htmlToText(html: string): string {
  return html
    .replace(BLOCK_TAG, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
