/**
 * Builds a one-page PDF with a single line of Helvetica text, so CV tests need no binary fixture in git.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/fixtures/tiny-pdf.ts
 * Deps:    node:zlib (Flate streams)
 * Tested:  n/a (test helper; used by cv-text.test.ts, cv-inflate.test.ts, src/workflow/__tests__/intake.test.ts and the apply tests)
 *
 * Key responsibilities:
 * - `tinyPdf(text)`: valid PDF 1.4 bytes with a correct xref table; `tinyPdf(null)` has no text at all
 * - `opts.deflate`: the content stream Flate-compressed, as real PDFs carry it; `opts.pad`: one more Flate stream of
 *   that many zero bytes (a decompression bomb when large), `opts.padFilter` / `opts.padImage` vary it;
 *   `opts.encrypt`: an /Encrypt entry in the trailer
 *
 * Design constraints:
 * - ASCII text only, no parentheses or backslashes (no PDF string escaping)
 * - Built as a latin1 string (one char per byte), so xref offsets are string offsets
 */
import { deflateSync } from "node:zlib";

export type TinyPdfOpts = { deflate?: boolean; pad?: number; padFilter?: string; padImage?: boolean; encrypt?: boolean };

const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("latin1");

function streamObj(data: string, dict: string): string {
  return `<< /Length ${String(data.length)}${dict} >>\nstream\n${data}\nendstream`;
}
export function tinyPdf(text: string | null, opts: TinyPdfOpts = {}): ArrayBuffer {
  const stream = text === null ? "" : `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const content = opts.deflate === true ? streamObj(latin1(deflateSync(stream)), " /Filter /FlateDecode") : streamObj(stream, "");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    content,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  if (opts.pad !== undefined) {
    const image = opts.padImage === true ? " /Subtype /Image /Width 1 /Height 1" : "";
    objs.push(streamObj(latin1(deflateSync(new Uint8Array(opts.pad))), `${image} /Filter ${opts.padFilter ?? "/FlateDecode"}`));
  }
  const encrypt = opts.encrypt === true ? " /Encrypt 99 0 R" : "";
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R${encrypt} >>\nstartxref\n${String(xref)}\n%%EOF\n`;
  const bytes = Buffer.from(out, "latin1");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
