import { patchZipEntry, readZipEntries } from "./minZip.js";
import {
  applyUpdatesToSheetXml,
  buildUpdates,
} from "./xlsxSheetPatch.js";

let cachedTemplate = null;

async function loadTemplate(templateFile) {
  if (cachedTemplate?.name === templateFile) return cachedTemplate.bytes;
  const res = await fetch(`/forms/templates/${templateFile}`);
  if (!res.ok) throw new Error(`Шаблон Excel не знайдено: ${templateFile}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("Замість xlsx сервер віддав не ZIP (перевірте шлях шаблону)");
  }
  cachedTemplate = { name: templateFile, bytes };
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
  return `${docId}_${lat}.xlsx`;
}

export class XlsxFillExporter {
  async generate(documentDef, values, templateFile) {
    const templateBytes = await loadTemplate(templateFile);
    const sheetPath = "xl/worksheets/sheet1.xml";

    const sheetEntry = readZipEntries(templateBytes).find(
      (e) => e.name === sheetPath,
    );
    if (!sheetEntry) throw new Error("Некоректний шаблон xlsx");

    const sheetXml = new TextDecoder("utf-8").decode(sheetEntry.data);
    const updates = buildUpdates(documentDef, values);
    const patched = applyUpdatesToSheetXml(sheetXml, updates);
    const newSheetBytes = new TextEncoder().encode(patched);

    const bytes = patchZipEntry(templateBytes, sheetPath, newSheetBytes);
    const fio = values.fio ?? values.email ?? "";
    return {
      fileName: downloadFileName(documentDef.id, fio),
      bytes,
    };
  }
}
