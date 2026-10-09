/**
 * Builds a minimal Word (.docx) file at test time: a stored (uncompressed) ZIP written byte by byte, no binary fixture.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/__tests__/fixtures/tiny-docx.ts
 * Deps:    none
 * Tested:  n/a (test helper; used by cv-text.test.ts and src/app/api/apply/__tests__/apply.test.ts)
 *
 * Key responsibilities:
 * - `tinyDocx(paragraphs)`: [Content_Types].xml, _rels/.rels and word/document.xml with one w:p per paragraph;
 *   `tinyDocx([])` is a valid document with no text at all
 * - Correct local headers, central directory, end record and CRC-32, so a real ZIP reader (mammoth's JSZip) opens it
 *
 * Design constraints:
 * - Method 0 (stored) only; paragraphs are XML-escaped, any Unicode is UTF-8 encoded
 */
const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  "</Types>";

const RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function documentXml(paragraphs: readonly string[]): string {
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  );
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Little-endian writer over a growable byte list. */
class Out {
  readonly bytes: number[] = [];
  u16(v: number): this {
    this.bytes.push(v & 0xff, (v >>> 8) & 0xff);
    return this;
  }
  u32(v: number): this {
    return this.u16(v & 0xffff).u16((v >>> 16) & 0xffff);
  }
  raw(b: Uint8Array): this {
    for (const x of b) this.bytes.push(x);
    return this;
  }
}

/** DOS date 1980-01-01, time 00:00. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

export function tinyDocx(paragraphs: readonly string[]): ArrayBuffer {
  const enc = new TextEncoder();
  const files: [string, string][] = [
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", RELS],
    ["word/document.xml", documentXml(paragraphs)],
  ];
  const out = new Out();
  const central = new Out();
  for (const [path, text] of files) {
    const name = enc.encode(path);
    const data = enc.encode(text);
    const crc = crc32(data);
    const offset = out.bytes.length;
    // Local file header: version 2.0, no flags, method 0 (stored).
    out.u32(0x04034b50).u16(20).u16(0).u16(0).u16(0).u16(DOS_DATE).u32(crc).u32(data.length).u32(data.length).u16(name.length).u16(0).raw(name).raw(data);
    // Central directory entry pointing back at the local header.
    central
      .u32(0x02014b50).u16(20).u16(20).u16(0).u16(0).u16(0).u16(DOS_DATE).u32(crc).u32(data.length).u32(data.length)
      .u16(name.length).u16(0).u16(0).u16(0).u16(0).u32(0).u32(offset).raw(name);
  }
  const cdOffset = out.bytes.length;
  out.raw(Uint8Array.from(central.bytes));
  // End of central directory record.
  out.u32(0x06054b50).u16(0).u16(0).u16(files.length).u16(files.length).u32(central.bytes.length).u32(cdOffset).u16(0);
  return Uint8Array.from(out.bytes).buffer;
}
