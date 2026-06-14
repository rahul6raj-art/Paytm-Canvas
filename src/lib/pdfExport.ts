/** Minimal single-page PDF with one JPEG XObject (no external PDF library). */
export function buildSinglePageJpegPdf(
  jpeg: Uint8Array,
  widthPt: number,
  heightPt: number,
): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    pos += b.length;
  };

  const pushBin = (b: Uint8Array) => {
    chunks.push(b);
    pos += b.length;
  };

  const recordObj = (
    id: number,
    body:
      | string
      | { head: string; stream: Uint8Array; tail?: string },
  ) => {
    offsets[id] = pos;
    pushStr(`${id} 0 obj\n`);
    if (typeof body === "string") {
      pushStr(body);
      pushStr("\nendobj\n");
      return;
    }
    pushStr(body.head);
    pushStr("stream\n");
    pushBin(body.stream);
    pushStr("\nendstream\n");
    if (body.tail) pushStr(body.tail);
    pushStr("\nendobj\n");
  };

  pushStr("%PDF-1.4\n");

  recordObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  recordObj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");

  const w = Math.max(1, Math.round(widthPt));
  const h = Math.max(1, Math.round(heightPt));
  const contentStream = `q\n${w} 0 0 ${h} 0 0 cm\n/Im1 Do\nQ\n`;
  recordObj(4, {
    head: `<< /Length ${contentStream.length} >>\n`,
    stream: enc.encode(contentStream),
  });

  recordObj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>`,
  );

  recordObj(5, {
    head: `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\n`,
    stream: jpeg,
  });

  const xrefPos = pos;
  const objCount = offsets.length;
  pushStr(`xref\n0 ${objCount}\n`);
  pushStr("0000000000 65535 f \n");
  for (let i = 1; i < objCount; i++) {
    pushStr(`${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  pushStr("trailer\n");
  pushStr(`<< /Size ${objCount} /Root 1 0 R >>\n`);
  pushStr("startxref\n");
  pushStr(`${xrefPos}\n`);
  pushStr("%%EOF\n");

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function jpegDataUrlToBytes(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const base64 = dataUrl.slice(comma + 1);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}
