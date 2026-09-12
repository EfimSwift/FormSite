export class JsonDocumentCatalog {
  constructor() {
    this.data = null;
  }

  async load() {
    if (this.data) return;
    const res = await fetch("/forms/documents.json");
    if (!res.ok) throw new Error("Не вдалося завантажити forms/documents.json");
    this.data = await res.json();
  }

  async listDocuments() {
    await this.load();
    return this.data.documents;
  }

  async getDocument(id) {
    await this.load();
    return this.data.documents.find((d) => d.id === id);
  }

  async getTemplateFile() {
    await this.load();
    return this.data.templateFile;
  }
}
