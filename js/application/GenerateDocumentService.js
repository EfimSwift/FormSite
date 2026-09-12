export class GenerateDocumentService {
  constructor(catalog, advisor, pdf) {
    this.catalog = catalog;
    this.advisor = advisor;
    this.pdf = pdf;
  }

  async listForms() {
    return this.catalog.listForms();
  }

  async getFillOptions(formId, data) {
    const form = await this.catalog.getForm(formId);
    if (!form) {
      throw new Error(`Форму не знайдено: ${formId}`);
    }
    return this.advisor.rankVariants(form.variants, data);
  }

  async generatePdf(formId, variantId, data) {
    const form = await this.catalog.getForm(formId);
    if (!form) {
      throw new Error(`Форму не знайдено: ${formId}`);
    }
    const variant = form.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new Error(`Варіант не знайдено: ${variantId}`);
    }
    const proposal = this.advisor.propose(variant, data);
    return this.pdf.generate(variant, data, proposal);
  }
}
