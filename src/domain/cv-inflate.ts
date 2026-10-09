/**
 * Decompression-bomb guard for CV files: how much a .docx (ZIP) or a PDF would inflate to, measured before a parser runs.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/domain/cv-inflate.ts
 * Deps:    DecompressionStream (Workers, Node 18+)
 * Tested:  src/domain/__tests__/cv-inflate.test.ts
 *
 * Key responsibilities:
 * - `zipInflateProblem`: walks the ZIP central directory and streams every entry through deflate-raw, counting bytes;
 *   a reason when the entries would inflate past CV_INFLATE_MAX, or the archive cannot be measured (ZIP64, odd method)
 * - `pdfInflateProblem`: the same for a PDF's non-image streams (the ones pdf.js inflates to read text); a reason when
 *   they pass the cap, or a filter or encryption hides what they would inflate to
 *
 * Design constraints:
 * - A 10 MB file can inflate a thousandfold; mammoth and unpdf inflate in memory inside a 128 MB request-time Worker,
 *   so the guard counts in a stream and stops reading at the cap: memory stays flat, CPU is bounded by the cap
 * - The declared sizes are not trusted: the real inflate output is counted (a lying header changes nothing)
 * - Data that does not inflate (corrupt) counts what came out; the parser fails on it later and says so in its note
 * - Pure computation, no I/O; never throws
 */

/** Most bytes the parsers may inflate from one CV file; real CVs stay under a few MB of XML or content streams. */
export const CV_INFLATE_MAX = 40 * 1024 * 1024;

/** More ZIP entries or PDF streams than any CV carries: refused before counting, so tiny entries cannot burn CPU. */
const PARTS_MAX = 5000;

/** Bytes `data` inflates to, read until it ends, fails or passes `budget` (then a number over the budget). */
async function inflatedSize(data: Uint8Array<ArrayBuffer>, format: "deflate" | "deflate-raw", budget: number): Promise<number> {
  const source = new ReadableStream<BufferSource>({
    start(c) {
      c.enqueue(data);
      c.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream(format)).getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return total;
      total += value.byteLength;
      if (total > budget) {
        await reader.cancel().catch(() => undefined);
        return total;
      }
    }
  } catch {
    return total;
  }
}

const tooLarge = (what: string): string => `${what} would inflate past ${String(CV_INFLATE_MAX / (1024 * 1024))} MB, not read`;

/** Why the ZIP must not be handed to a parser, or null when every entry inflates within CV_INFLATE_MAX. */
export async function zipInflateProblem(bytes: ArrayBuffer): Promise<string | null> {
  const view = new DataView(bytes);
  const u8 = new Uint8Array(bytes);
  // End of central directory: the last 0x06054b50 within the trailing 22 + 65535 (comment) bytes.
  let eocd = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null; // not a ZIP the parser can open either; it notes that itself
  const entries = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || at === 0xffffffff) return "Word file uses ZIP64, not read";
  if (entries > PARTS_MAX) return `Word file has ${String(entries)} parts, not read`;
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (at + 46 > bytes.byteLength || view.getUint32(at, true) !== 0x02014b50) return null; // broken directory: the parser fails on it
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const local = view.getUint32(at + 42, true);
    const nameLen = view.getUint16(at + 28, true);
    at += 46 + nameLen + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (compressed === 0xffffffff || local === 0xffffffff) return "Word file uses ZIP64, not read";
    if (local + 30 > bytes.byteLength || view.getUint32(local, true) !== 0x04034b50) return null;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = u8.subarray(start, Math.min(bytes.byteLength, start + compressed));
    if (method === 0) total += data.byteLength;
    else if (method === 8) total += await inflatedSize(data, "deflate-raw", CV_INFLATE_MAX - total);
    else return `Word file uses ZIP method ${String(method)}, not read`;
    if (total > CV_INFLATE_MAX) return tooLarge("Word file");
  }
  return null;
}

/** Filters that never expand (ASCII encodings) or that pdf.js does not run to read text (image codecs). */
const FLAT_FILTERS = new Set(["ASCIIHexDecode", "ASCII85Decode", "DCTDecode", "JPXDecode", "JBIG2Decode", "CCITTFaxDecode"]);

/** A stream's /Length when it is a plain or resolvable indirect integer, else null. */
function streamLength(text: string, dict: string): number | null {
  const direct = /\/Length\s+(\d+)(?!\d)(?!\s+\d+\s+R)/.exec(dict);
  if (direct?.[1] !== undefined) return Number(direct[1]);
  const ref = /\/Length\s+(\d+)\s+(\d+)\s+R/.exec(dict);
  if (ref?.[1] === undefined || ref[2] === undefined) return null;
  const target = new RegExp(`(?:^|[^0-9])${ref[1]}\\s+${ref[2]}\\s+obj\\s*(\\d+)`).exec(text);
  return target?.[1] === undefined ? null : Number(target[1]);
}

/** Why the PDF must not be handed to pdf.js, or null when its text-bearing streams inflate within CV_INFLATE_MAX. */
export async function pdfInflateProblem(bytes: ArrayBuffer): Promise<string | null> {
  // latin1 keeps one character per byte, so string offsets are byte offsets.
  const text = new TextDecoder("latin1").decode(bytes);
  if (/\/Encrypt\b/.test(text)) return "PDF is encrypted, not read";
  const u8 = new Uint8Array(bytes);
  const keyword = /(?<!end)stream(?:\r\n|\n|\r)/g;
  let total = 0;
  let parts = 0;
  for (let m = keyword.exec(text); m !== null; m = keyword.exec(text)) {
    if (++parts > PARTS_MAX) return `PDF has more than ${String(PARTS_MAX)} streams, not read`;
    const start = m.index + m[0].length;
    const dict = text.slice(Math.max(0, text.lastIndexOf("obj", m.index)), m.index);
    const length = streamLength(text, dict);
    const end = length !== null && start + length <= bytes.byteLength ? start + length : text.indexOf("endstream", start);
    const stop = end < 0 ? bytes.byteLength : end;
    keyword.lastIndex = stop;
    if (/\/Subtype\s*\/Image/.test(dict)) continue;
    const filter = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(dict)?.[1] ?? "";
    const filters = [...filter.matchAll(/\/([A-Za-z0-9]+)/g)].map((f) => f[1] ?? "");
    const data = u8.subarray(start, stop);
    if (filters.every((f) => FLAT_FILTERS.has(f))) total += data.byteLength;
    else if (filters.length === 1 && filters[0] === "FlateDecode") total += await inflatedSize(data, "deflate", CV_INFLATE_MAX - total);
    else return `PDF uses the ${filters.join(" + ")} filter, not read`;
    if (total > CV_INFLATE_MAX) return tooLarge("PDF");
  }
  return null;
}
