export class DocumentFillService {
  constructor(catalog, xlsxPdf, xlsxFill) {
    this.catalog = catalog;
    this.xlsxPdf = xlsxPdf;
    this.xlsxFill = xlsxFill;
  }

  async listDocuments() {
    return this.catalog.listDocuments();
  }

  async generatePdf(documentId, values) {
    const doc = await this.catalog.getDocument(documentId);
    if (!doc) throw new Error("Документ не знайдено");
    const templateFile = await this.catalog.getTemplateFile();
    return this.xlsxPdf.generate(doc, values, templateFile);
  }

  async generateXlsx(documentId, values) {
    const doc = await this.catalog.getDocument(documentId);
    if (!doc) throw new Error("Документ не знайдено");
    const templateFile = await this.catalog.getTemplateFile();
    return this.xlsxFill.generate(doc, values, templateFile);
  }
}
