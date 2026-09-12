import { PDFDocument, rgb } from "../../../vendor/pdf-lib.esm.min.js";
import fontkit from "../../../vendor/fontkit.es.js";

let cachedFontBytes = null;

async function loadBodyFont(pdf) {
  if (!cachedFontBytes) {
    const paths = ["/fonts/DejaVuSans.ttf", "/fonts/Arial.ttf"];
    let lastErr = null;
    for (const url of paths) {
      const res = await fetch(url);
      if (res.ok) {
        cachedFontBytes = await res.arrayBuffer();
        break;
      }
      lastErr = url;
    }
    if (!cachedFontBytes) {
      throw new Error(
        "Немає шрифту для PDF. Додайте fonts/DejaVuSans.ttf (python tools/fetch_dejavu_font.py) або Arial (tools/copy-pdf-font.ps1).",
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
