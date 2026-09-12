import { GenerateDocumentService } from "../application/GenerateDocumentService.js";
import { RuleBasedFormFillAdvisor } from "../infrastructure/ai/RuleBasedFormFillAdvisor.js";
import { JsonFormCatalog } from "../infrastructure/forms/JsonFormCatalog.js";
import { PdfLibGenerator } from "../infrastructure/pdf/PdfLibGenerator.js";

const catalog = new JsonFormCatalog();
const advisor = new RuleBasedFormFillAdvisor();
const pdf = new PdfLibGenerator();

export const documentService = new GenerateDocumentService(
  catalog,
  advisor,
  pdf,
);

export function downloadPdf(fileName, bytes) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
