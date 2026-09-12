import XLSX from "../../../vendor/xlsx.mjs";
import { PDFDocument, rgb } from "../../../vendor/pdf-lib.esm.min.js";
import fontkit from "../../../vendor/fontkit.es.js";

let cachedFontBytes = null;
let cachedTemplate = null;

const DEFAULT_COL_WCH = 8.43;
const DEFAULT_ROW_HPT = 16;

function isFontBinary(bytes) {
  if (!bytes?.byteLength) return false;
  const v = new Uint8Array(bytes);
  return (
    (v[0] === 0 && v[1] === 1 && v[2] === 0 && v[3] === 0) ||
    (v[0] === 0x4f && v[1] === 0x54 && v[2] === 0x54 && v[3] === 0x4f)
  );
}

async function loadBodyFont(pdf) {
  if (!cachedFontBytes) {
    for (const url of ["/fonts/Arial.ttf", "/fonts/DejaVuSans.ttf"]) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (isFontBinary(buf)) {
        cachedFontBytes = buf;
        break;
      }
    }
  }
  if (!cachedFontBytes) {
    throw new Error("Потрібен fonts/Arial.ttf у репозиторії");
  }
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(new Uint8Array(cachedFontBytes), { subset: false });
}

async function loadTemplate(templateFile) {
  if (cachedTemplate?.name === templateFile) return cachedTemplate.bytes;
  const res = await fetch(`/forms/templates/${templateFile}`);
  if (!res.ok) throw new Error(`Шаблон Excel не знайдено: ${templateFile}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  cachedTemplate = { name: templateFile, bytes };
  return bytes;
}

function setCell(ws, addr, value) {
  const v = String(value ?? "");
  if (!v) {
    delete ws[addr];
    return;
  }
  ws[addr] = { t: "s", v };
}

function downloadFileName(docId, fio) {
  const map = {
    а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie",
    ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l",
    м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ю: "iu",
    я: "ia", ь: "", "'": "", "’": "",
  };
  let lat = "";
  for (const ch of (fio ?? "document").trim().toLowerCase()) {
    lat += map[ch] ?? (/[a-z0-9_-]/i.test(ch) ? ch : "_");
  }
  lat = lat.replace(/_+/g, "_").replace(/^_|_$/g, "") || "document";
  return `${docId}_${lat}.pdf`;
}

/** Ширина колонки в «символах Excel» (wch). */
function colWch(ws, colIndex) {
  const col = ws["!cols"]?.[colIndex];
  if (col?.wch) return col.wch;
  if (col?.width) return col.width;
  return DEFAULT_COL_WCH;
}

function rowHpt(ws, rowIndex) {
  const row = ws["!rows"]?.[rowIndex];
  if (row?.hpt) return row.hpt;
  if (row?.hpx) return row.hpx * 0.75;
  return DEFAULT_ROW_HPT;
}

function buildMergeMaps(merges) {
  const skip = new Set();
  const spanAt = new Map();

  for (const m of merges) {
    const master = XLSX.utils.encode_cell(m.s);
    spanAt.set(master, m);
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        skip.add(XLSX.utils.encode_cell({ r, c }));
      }
    }
  }
  return { skip, spanAt };
}

function regionSize(ws, m, colScale, rowHeights) {
  let w = 0;
  for (let c = m.s.c; c <= m.e.c; c++) {
    w += colWch(ws, c) * colScale;
  }
  let h = 0;
  for (let r = m.s.r; r <= m.e.r; r++) {
    h += rowHeights.get(r) ?? DEFAULT_ROW_HPT;
  }
  return { w, h };
}

function wrapLines(text, font, size, maxWidth) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);
    if (width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCellText(page, font, text, x, y, w, h) {
  const pad = 3;
  const maxWidth = Math.max(8, w - pad * 2);
  let size = 9;
  if (w < 55) size = 7;
  if (w > 120 && text.length > 60) size = 8;

  let lines = wrapLines(text, font, size, maxWidth);
  const lineH = size + 2;
  while (lines.length * lineH > h - pad * 2 && size > 6) {
    size -= 1;
    lines = wrapLines(text, font, size, maxWidth);
  }

  let baseline = y + h - pad - size;
  for (const ln of lines) {
    if (baseline < y + pad) break;
    page.drawText(ln, {
      x: x + pad,
      y: baseline,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    baseline -= lineH;
  }
}

/** Прибираємо демо-дані з іншого блоку форми. */
function clearOtherSections(ws, documentDef) {
  const clearRanges = documentDef.clearCells ?? [];
  for (const addr of clearRanges) {
    delete ws[addr];
  }
}

export class XlsxPdfGenerator {
  async generate(documentDef, values, templateFile) {
    const templateBytes = await loadTemplate(templateFile);
    const wb = XLSX.read(templateBytes, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    for (const field of documentDef.fields) {
      setCell(ws, field.cell, values[field.id] ?? "");
    }
    clearOtherSections(ws, documentDef);

    const rangeStr = documentDef.pdfRange || ws["!ref"] || "A1:F18";
    const range = XLSX.utils.decode_range(rangeStr);
    const merges = (ws["!merges"] || []).filter((m) => {
      return (
        m.e.r >= range.s.r &&
        m.s.r <= range.e.r &&
        m.e.c >= range.s.c &&
        m.s.c <= range.e.c
      );
    });
    const { skip, spanAt } = buildMergeMaps(merges);

    let totalWch = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      totalWch += colWch(ws, c);
    }

    const pageW = 841.89;
    const pageH = 595.28;
    const margin = 32;
    const tableW = pageW - margin * 2;
    const colScale = tableW / totalWch;

    const rowHeights = new Map();
    let totalH = 0;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const h = rowHpt(ws, r);
      rowHeights.set(r, h);
      totalH += h;
    }

    const pdf = await PDFDocument.create();
    const font = await loadBodyFont(pdf);
    const page = pdf.addPage([pageW, pageH]);

    let tableTop = margin + (pageH - margin * 2 - totalH) / 2 + totalH;
    if (tableTop > pageH - margin) tableTop = pageH - margin;

    const colX = new Map();
    let x = margin;
    for (let c = range.s.c; c <= range.e.c; c++) {
      colX.set(c, x);
      x += colWch(ws, c) * colScale;
    }

    const rowY = new Map();
    let y = tableTop;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const h = rowHeights.get(r);
      y -= h;
      rowY.set(r, y);
    }

    const border = rgb(0.35, 0.35, 0.38);
    const fillHeader = rgb(0.96, 0.96, 0.97);

    const headerRows = new Set([8, 9, 13]);

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (skip.has(addr)) continue;

        const m = spanAt.get(addr) ?? {
          s: { r, c },
          e: { r, c },
        };
        const { w, h } = regionSize(ws, m, colScale, rowHeights);
        const x0 = colX.get(m.s.c);
        const y0 = rowY.get(m.s.r);

        page.drawRectangle({
          x: x0,
          y: y0,
          width: w,
          height: h,
          borderColor: border,
          borderWidth: 0.6,
          color: headerRows.has(r) ? fillHeader : undefined,
        });

        const cell = ws[addr];
        const raw = cell?.v;
        if (raw === undefined || raw === null || raw === "") continue;
        drawCellText(page, font, String(raw), x0, y0, w, h);
      }
    }

    const bytes = await pdf.save();
    const fio = values.fio ?? values.email ?? "";
    return {
      fileName: downloadFileName(documentDef.id, fio),
      bytes,
    };
  }
}
