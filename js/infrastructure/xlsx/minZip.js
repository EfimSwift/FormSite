import { inflateRaw, deflateRaw } from "../../../vendor/pako.esm.mjs";

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

/** Распаковка .xlsx (ZIP, method 0 или 8). */
export function unzipBytes(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const files = {};
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const sig = view.getUint32(offset, true);
    if (sig === SIG_LOCAL) {
      const method = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const uncompSize = view.getUint32(offset + 22, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const name = new TextDecoder().decode(
        buffer.subarray(nameStart, nameStart + nameLen),
      );
      const dataStart = nameStart + nameLen + extraLen;
      const compData = buffer.subarray(dataStart, dataStart + compSize);
      let data;
      if (method === 0) data = compData;
      else if (method === 8) {
        data = inflateRaw(compData);
        if (uncompSize && data.length !== uncompSize) {
          /* tolerate */
        }
      } else {
        throw new Error(`ZIP method ${method} not supported`);
      }
      files[name] = data;
      offset = dataStart + compSize;
      continue;
    }
    if (sig === SIG_CENTRAL || sig === SIG_EOCD) break;
    offset += 1;
  }
  return files;
}

export function zipBytes(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const enc = new TextEncoder();

  for (const [name, data] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const compressed = deflateRaw(data);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 8, true);
    lv.setUint16(10, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    chunks.push(local);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 8, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    chunks.push(c);
    centralSize += c.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, SIG_EOCD, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  chunks.push(eocd);

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
