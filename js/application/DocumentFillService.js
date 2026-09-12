export class DocumentFillService {
  constructor(catalog, xlsxPdf) {
    this.catalog = catalog;
    this.xlsxPdf = xlsxPdf;
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
}
