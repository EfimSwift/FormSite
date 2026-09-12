import { DocumentFillService } from "../application/DocumentFillService.js";
import { JsonDocumentCatalog } from "../infrastructure/forms/JsonDocumentCatalog.js";
import { XlsxPdfGenerator } from "../infrastructure/xlsx/XlsxPdfGenerator.js";
import { XlsxFillExporter } from "../infrastructure/xlsx/XlsxFillExporter.js";

const catalog = new JsonDocumentCatalog();
const xlsxPdf = new XlsxPdfGenerator();
const xlsxFill = new XlsxFillExporter();

export const documentService = new DocumentFillService(catalog, xlsxPdf, xlsxFill);

export function downloadBlob(fileName, bytes, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPdf(fileName, bytes) {
  downloadBlob(fileName, bytes, "application/pdf");
}

export function downloadXlsx(fileName, bytes) {
  downloadBlob(
    fileName,
    bytes,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
