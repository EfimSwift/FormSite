import { PDFDocument, rgb } from "../../../vendor/pdf-lib.esm.min.js";
import fontkit from "../../../vendor/fontkit.es.js";

let cachedFontBytes = null;
let cachedPdfTemplate = null;

/** Координаты ячеек в пунктах Excel (как Range.Left/Top/Width/Height). */
const CELL_RECTS = {
  B10: { left: 48, top: 152.4, w: 102, h: 24 },
  C10: { left: 150, top: 152.4, w: 124.2, h: 24 },
  D10: { left: 274.2, top: 152.4, w: 109.8, h: 24 },
  E10: { left: 384, top: 152.4, w: 85.8, h: 24 },
  F10: { left: 469.8, top: 152.4, w: 75.6, h: 24 },
  B14: { left: 48, top: 238.2, w: 102, h: 55.8 },
  C14: { left: 150, top: 238.2, w: 124.2, h: 55.8 },
  D14: { left: 274.2, top: 238.2, w: 109.8, h: 55.8 },
  E14: { left: 384, top: 238.2, w: 85.8, h: 55.8 },
  F14: { left: 469.8, top: 238.2, w: 75.6, h: 55.8 },
};

/** Параметры печати листа A1:F18 → PDF (ExportAsFixedFormat, Excel). */
const PRINT_MAP = {
  pageWidth: 595.2,
  pageHeight: 841.68,
  sheetWidth: 545.4,
  sheetHeight: 349.2,
  margin: 36,
};

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

function isPdfBinary(bytes) {
  return bytes?.byteLength >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50;
}

async function loadPdfTemplate(file) {
  if (cachedPdfTemplate?.name === file) return cachedPdfTemplate.bytes;
  const res = await fetch(`/forms/templates/${file}`);
  if (!res.ok) {
    throw new Error(
      "PDF-шаблон не знайдено (forms/templates/interactive-board-print.pdf). Зробіть push у git і redeploy.",
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!isPdfBinary(bytes)) {
    throw new Error(
      "Замість PDF сервер віддав HTML (404). Перевірте, що interactive-board-print.pdf задеплоєно.",
    );
  }
  cachedPdfTemplate = { name: file, bytes };
  return bytes;
}

function printScale() {
  const { pageWidth, pageHeight, sheetWidth, sheetHeight, margin } = PRINT_MAP;
  const innerW = pageWidth - margin * 2;
  const innerH = pageHeight - margin * 2;
  return Math.min(innerW / sheetWidth, innerH / sheetHeight);
}

function cellToPdf(rect) {
  const scale = printScale();
  const { pageHeight, margin } = PRINT_MAP;
  const sheetW = PRINT_MAP.sheetWidth * scale;
  const sheetH = PRINT_MAP.sheetHeight * scale;
  const offsetX = (PRINT_MAP.pageWidth - sheetW) / 2;
  const offsetY = (PRINT_MAP.pageHeight - sheetH) / 2;

  const x = offsetX + rect.left * scale + 2;
  const boxTop = offsetY + rect.top * scale;
  const boxH = rect.h * scale;
  const maxWidth = rect.w * scale - 4;
  const y = pageHeight - (boxTop + boxH * 0.72);
  const fontSize = boxH > 30 ? 9 : 8;
  return { x, y, maxWidth, fontSize };
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

export class XlsxPdfGenerator {
  async generate(documentDef, values, _templateFile) {
    const pdfTemplateFile =
      documentDef.pdfTemplateFile ?? "interactive-board-print.pdf";
    const templateBytes = await loadPdfTemplate(pdfTemplateFile);
    const pdf = await PDFDocument.load(templateBytes);
    const font = await loadBodyFont(pdf);
    const page = pdf.getPages()[0];
    if (!page) throw new Error("PDF-шаблон без сторінок");

    const { width, height } = page.getSize();
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error("Некоректний розмір PDF-шаблону");
    }

    for (const field of documentDef.fields) {
      const text = String(values[field.id] ?? "").trim();
      if (!text) continue;
      const rect = CELL_RECTS[field.cell];
      if (!rect) continue;
      const pos = cellToPdf(rect);
      page.drawText(text, {
        x: pos.x,
        y: pos.y,
        size: pos.fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: pos.maxWidth,
        lineHeight: pos.fontSize + 1,
      });
    }

    const bytes = await pdf.save();
    return {
      fileName: downloadFileName(documentDef.id, values.fio ?? values.email),
      bytes,
    };
  }
}
