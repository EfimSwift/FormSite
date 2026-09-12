import { documentService, downloadPdf, downloadXlsx } from "./app/compositionRoot.js";
import { authService } from "./infrastructure/auth/AuthService.js";

const app = document.querySelector("#app");

let documents = [];
let selectedDoc = null;
let fieldValues = {};
let state = {
  view: authService.isAuthenticated() ? "app" : "login",
  selectedDocumentId: "",
  busy: false,
  error: null,
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === "className") node.className = v;
      else node.setAttribute(k, v);
    }
  }
  for (const ch of children) {
    node.append(typeof ch === "string" ? document.createTextNode(ch) : ch);
  }
  return node;
}

function onDocumentChange(docId) {
  selectedDoc = documents.find((d) => d.id === docId) ?? null;
  fieldValues = {};
  if (selectedDoc) {
    for (const f of selectedDoc.fields) fieldValues[f.id] = "";
  }
  setState({ selectedDocumentId: docId, error: null });
}

function renderLogin() {
  app.innerHTML = "";
  const userInput = el("input", { type: "text", placeholder: "Логін" });
  const passInput = el("input", { type: "password", placeholder: "Пароль" });
  const form = el("form", { className: "login-wrap" });
  const card = el("div", { className: "card login-card" });
  card.append(
    el("h2", {}, "Вхід до FormSite"),
    el("label", { className: "field" }, "Логін", userInput),
    el("label", { className: "field" }, "Пароль", passInput),
  );
  const errNode = el("p", { className: "error" });
  errNode.hidden = true;
  card.append(errNode);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!authService.login(userInput.value.trim(), passInput.value)) {
      errNode.textContent = "Невірний логін або пароль";
      errNode.hidden = false;
      return;
    }
    setState({ view: "app" });
  });
  card.append(el("div", { className: "actions" }, el("button", { type: "submit" }, "Увійти")));
  form.append(card);
  app.append(form);
}

function renderApp() {
  app.innerHTML = "";
  const header = el("header", { className: "site-header" });
  header.append(
    el("div", {}, el("h1", {}, "FormSite"), el("p", {}, "Заповнення форм з Excel-шаблону")),
    (() => {
      const b = el("button", { type: "button", className: "secondary" }, "Вийти");
      b.addEventListener("click", () => {
        authService.logout();
        setState({ view: "login" });
      });
      return b;
    })(),
  );

  const docCard = el("section", { className: "card" });
  docCard.append(el("h2", {}, "1. Оберіть документ"));
  const select = el("select", { id: "doc-select" });
  select.append(el("option", { value: "" }, "— оберіть —"));
  for (const d of documents) {
    const opt = el("option", { value: d.id });
    opt.textContent = d.title;
    if (d.id === state.selectedDocumentId) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", () => onDocumentChange(select.value));
  docCard.append(el("label", { className: "field" }, "Тип документа", select));
  if (selectedDoc?.description) {
    docCard.append(el("p", { className: "hint" }, selectedDoc.description));
  }

  const layout = el("div", { className: "layout" });
  layout.append(header, docCard);

  if (selectedDoc) {
    const dataCard = el("section", { className: "card" });
    dataCard.append(el("h2", {}, "2. Заповніть поля"));
    const grid = el("div", { className: "grid two" });
    for (const field of selectedDoc.fields) {
      const input =
        field.type === "textarea"
          ? (() => {
              const ta = el("textarea", {
                rows: "3",
                id: `f-${field.id}`,
              });
              ta.value = fieldValues[field.id] ?? "";
              ta.addEventListener("input", () => {
                fieldValues[field.id] = ta.value;
              });
              return ta;
            })()
          : el("input", {
              type:
                field.type === "email"
                  ? "email"
                  : field.type === "date"
                    ? "date"
                    : "text",
              value: fieldValues[field.id] ?? "",
              id: `f-${field.id}`,
            });
      if (field.type !== "textarea") {
        input.addEventListener("input", () => {
          fieldValues[field.id] = input.value;
        });
      }
      grid.append(el("label", { className: "field" }, field.label, input));
    }
    dataCard.append(grid);

    const genPdfBtn = el("button", { type: "button" }, "Згенерувати PDF");
    genPdfBtn.disabled = state.busy;
    const genXlsxBtn = el(
      "button",
      { type: "button", className: "secondary" },
      "Завантажити Excel (.xlsx)",
    );
    genXlsxBtn.disabled = state.busy;

    genPdfBtn.addEventListener("click", async () => {
      setState({ busy: true, error: null });
      try {
        const pdf = await documentService.generatePdf(
          selectedDoc.id,
          fieldValues,
        );
        downloadPdf(pdf.fileName, pdf.bytes);
        setState({ busy: false });
      } catch (e) {
        setState({
          busy: false,
          error: e instanceof Error ? e.message : "Помилка",
        });
      }
    });

    genXlsxBtn.addEventListener("click", async () => {
      setState({ busy: true, error: null });
      try {
        const xlsx = await documentService.generateXlsx(
          selectedDoc.id,
          fieldValues,
        );
        downloadXlsx(xlsx.fileName, xlsx.bytes);
        setState({ busy: false });
      } catch (e) {
        setState({
          busy: false,
          error: e instanceof Error ? e.message : "Помилка",
        });
      }
    });

    dataCard.append(
      el("p", { className: "hint" }, "Excel — той самий шаблон із рамками. PDF — друкований бланк Excel + ваш текст у комірках."),
      el("div", { className: "actions" }, genPdfBtn, genXlsxBtn),
    );
    layout.append(dataCard);
  }

  if (state.error) layout.append(el("p", { className: "error" }, state.error));
  app.append(layout);
}

function render() {
  if (state.view === "login") renderLogin();
  else renderApp();
}

async function bootstrap() {
  try {
    documents = await documentService.listDocuments();
  } catch (e) {
    state.error = e instanceof Error ? e.message : "Помилка завантаження";
  }
  render();
}

bootstrap();
