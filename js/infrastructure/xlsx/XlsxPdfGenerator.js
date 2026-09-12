import { PDFDocument } from "../../../vendor/pdf-lib.esm.min.js";
import fontkit from "../../../vendor/fontkit.es.js";
import { INTERACTIVE_BOARD_PDF_CELLS } from "./interactiveBoardPdfPlacements.js";
import { drawTextInCellWithPages } from "./pdfCellText.js";

let cachedFontBytes = null;
let cachedPdfTemplate = null;

const CELL_STYLE = {
  B10: { maxSize: 8, minSize: 6, vAlign: "center", hAlign: "center" },
  C10: { maxSize: 8, minSize: 6, vAlign: "center", hAlign: "center" },
  D10: { maxSize: 8, minSize: 6, vAlign: "center", hAlign: "center" },
  E10: { maxSize: 7.5, minSize: 6, vAlign: "center", hAlign: "center" },
  F10: { maxSize: 7, minSize: 5.5, vAlign: "center", hAlign: "center" },
  B14: { maxSize: 8, minSize: 5.5, vAlign: "center", hAlign: "center" },
  C14: { maxSize: 7.5, minSize: 5, vAlign: "center", hAlign: "center" },
  D14: { maxSize: 8, minSize: 6, vAlign: "center", hAlign: "center" },
  E14: { maxSize: 7, minSize: 5.5, vAlign: "center", hAlign: "center" },
  F14: { maxSize: 5.5, minSize: 4, vAlign: "center", hAlign: "center" },
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
  return pdf.embedFont(new Uint8Array(cachedFontBytes), { subset: true });
}

function isPdfBinary(bytes) {
  return bytes?.byteLength >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50;
}

async function loadPdfTemplate(file) {
  if (cachedPdfTemplate?.name === file) return cachedPdfTemplate.bytes;
  const res = await fetch(`/forms/templates/${file}`);
  if (!res.ok) {
    throw new Error(
      "PDF-шаблон не знайдено (forms/templates/interactive-board-print.pdf).",
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!isPdfBinary(bytes)) {
    throw new Error("Замість PDF сервер віддав HTML (404).");
  }
  cachedPdfTemplate = { name: file, bytes };
  return bytes;
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
    const pages = [...pdf.getPages()];

    for (const field of documentDef.fields) {
      const text = String(values[field.id] ?? "").trim();
      if (!text) continue;

      const box = INTERACTIVE_BOARD_PDF_CELLS[field.cell];
      if (!box) continue;

      const style = CELL_STYLE[field.cell] ?? {
        maxSize: 8,
        minSize: 5,
        vAlign: "center",
        hAlign: "center",
      };
      drawTextInCellWithPages(pdf, pages, font, text, box, style);
    }

    const bytes = await pdf.save({ useObjectStreams: false });
    return {
      fileName: downloadFileName(documentDef.id, values.fio ?? values.email),
      bytes,
    };
  }
}
