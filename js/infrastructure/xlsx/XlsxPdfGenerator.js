import XLSX from "../../../vendor/xlsx.mjs";
import { PDFDocument, rgb } from "../../../vendor/pdf-lib.esm.min.js";
import fontkit from "../../../vendor/fontkit.es.js";

let cachedFontBytes = null;
let cachedTemplate = null;

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
  return pdf.embedFont(new Uint8Array(cachedFontBytes), { subset: true });
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
    я: "ia", ь: "", "'": "",
  };
  let lat = "";
  for (const ch of (fio ?? "document").trim().toLowerCase()) {
    lat += map[ch] ?? (/[a-z0-9_-]/i.test(ch) ? ch : "_");
  }
  lat = lat.replace(/_+/g, "_").replace(/^_|_$/g, "") || "document";
  return `${docId}_${lat}.pdf`;
}

export class XlsxPdfGenerator {
  /**
   * @param {object} documentDef from documents.json
   * @param {Record<string, string>} values field id -> value
   * @param {string} templateFile
   */
  async generate(documentDef, values, templateFile) {
    const templateBytes = await loadTemplate(templateFile);
    const wb = XLSX.read(templateBytes, { type: "array" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    for (const field of documentDef.fields) {
      setCell(ws, field.cell, values[field.id] ?? "");
    }

    const rangeStr = documentDef.pdfRange || ws["!ref"] || "A1:F18";
    const range = XLSX.utils.decode_range(rangeStr);

    const pdf = await PDFDocument.create();
    const font = await loadBodyFont(pdf);
    const page = pdf.addPage([841.89, 595.28]);
    const colWidth = 118;
    const rowHeight = 15;
    const marginX = 28;
    const topY = 568;

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell?.v && cell?.v !== 0) continue;
        const text = String(cell.v).replace(/\s+/g, " ").trim();
        if (!text) continue;
        const x = marginX + (c - range.s.c) * colWidth;
        const y = topY - (r - range.s.r) * rowHeight;
        const size = text.length > 45 ? 7 : 8;
        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0.05, 0.05, 0.08),
          maxWidth: colWidth - 6,
          lineHeight: size + 2,
        });
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
