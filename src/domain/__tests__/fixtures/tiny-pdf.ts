/**
 * Builds a one-page PDF with a single line of Helvetica text, so CV tests need no binary fixture in git.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/fixtures/tiny-pdf.ts
 * Deps:    none
 * Tested:  n/a (test helper; used by cv-text.test.ts and src/workflow/__tests__/intake.test.ts)
 *
 * Key responsibilities:
 * - `tinyPdf(text)`: valid PDF 1.4 bytes with a correct xref table; `tinyPdf(null)` has no text at all
 *
 * Design constraints:
 * - ASCII text only, no parentheses or backslashes (no PDF string escaping)
 */
export function tinyPdf(text: string | null): ArrayBuffer {
  const stream = text === null ? "" : `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;
  const bytes = new TextEncoder().encode(out);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
