import { DocumentFillService } from "../application/DocumentFillService.js";
import { JsonDocumentCatalog } from "../infrastructure/forms/JsonDocumentCatalog.js";
import { XlsxPdfGenerator } from "../infrastructure/xlsx/XlsxPdfGenerator.js";

const catalog = new JsonDocumentCatalog();
const xlsxPdf = new XlsxPdfGenerator();

export const documentService = new DocumentFillService(catalog, xlsxPdf);

export function downloadPdf(fileName, bytes) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
