import { PDFDocument, rgb } from "../../../vendor/pdf-lib.esm.min.js";
import fontkit from "../../../vendor/fontkit.es.js";

let cachedFontBytes = null;

function isFontBinary(bytes) {
  if (!bytes || bytes.byteLength < 4) return false;
  const v = new Uint8Array(bytes);
  const ttf = v[0] === 0 && v[1] === 1 && v[2] === 0 && v[3] === 0;
  const otto =
    v[0] === 0x4f && v[1] === 0x54 && v[2] === 0x54 && v[3] === 0x4f;
  const woff =
    v[0] === 0x77 && v[1] === 0x4f && v[2] === 0x46 && v[3] === 0x46;
  return ttf || otto || woff;
}

async function loadBodyFont(pdf) {
  if (!cachedFontBytes) {
    const paths = [
      "/fonts/Arial.ttf",
      "/fonts/DejaVuSans.ttf",
      "/vendor/fonts/Arial.ttf",
    ];
    for (const url of paths) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (!isFontBinary(buf)) continue;
      cachedFontBytes = buf;
      break;
    }
    if (!cachedFontBytes) {
      throw new Error(
        "Шрифт для PDF не знайдено (або сервер віддав HTML замість .ttf). Додайте fonts/Arial.ttf у репозиторій і зробіть push.",
      );
    }
  }
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(new Uint8Array(cachedFontBytes), { subset: true });
}

async function fetchTemplate(file) {
  const paths = [`/forms/templates/${file}`, `/public/forms/${file}`];
  for (const url of paths) {
    const res = await fetch(url);
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
  }
  throw new Error(`Не вдалося завантажити шаблон: ${file}`);
}

export class PdfLibGenerator {
  async generate(variant, data, proposal) {
    const templateBytes = await fetchTemplate(variant.templateFile);
    const pdf = await PDFDocument.load(templateBytes);
    const font = await loadBodyFont(pdf);
    const pages = pdf.getPages();

    for (const placement of variant.placements) {
      const mapping = proposal.mappings.find(
        (m) => m.semantic === placement.semantic,
      );
      const text = (mapping?.value ?? data[placement.semantic] ?? "").trim();
      if (!text) continue;

      const page = pages[placement.page];
      if (!page) continue;

      page.drawText(text, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? 11,
        font,
        color: rgb(0.1, 0.1, 0.15),
        maxWidth: placement.maxWidth,
      });
    }

    const bytes = await pdf.save();
    const safeFio = (data.fio ?? "document").replace(/[^\p{L}\p{N}\-_]+/gu, "_");
    return {
      fileName: `${variant.id}_${safeFio}.pdf`,
      bytes,
    };
  }
}
