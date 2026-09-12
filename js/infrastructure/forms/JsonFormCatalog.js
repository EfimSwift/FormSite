export class JsonFormCatalog {
  constructor() {
    this.forms = null;
  }

  async load() {
    if (this.forms) return;
    const res = await fetch("/forms/catalog.json");
    if (!res.ok) {
      throw new Error("Не вдалося завантажити каталог форм");
    }
    const data = await res.json();
    this.forms = data.forms;
  }

  async listForms() {
    await this.load();
    return [...this.forms];
  }

  async getForm(id) {
    await this.load();
    return this.forms.find((f) => f.id === id);
  }
}
