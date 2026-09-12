import { documentService, downloadPdf } from "./app/compositionRoot.js";
import { authService } from "./infrastructure/auth/AuthService.js";
import {
  emptyUserData,
  FIELD_META,
  formatScore,
} from "./presentation/state.js";

const app = document.querySelector("#app");

let forms = [];
let state = {
  view: authService.isAuthenticated() ? "app" : "login",
  userData: emptyUserData(),
  selectedFormId: "",
  proposals: null,
  modalOpen: false,
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

function renderLogin() {
  app.innerHTML = "";
  const userInput = el("input", {
    type: "text",
    autocomplete: "username",
    placeholder: "Логін",
  });
  const passInput = el("input", {
    type: "password",
    autocomplete: "current-password",
    placeholder: "Пароль",
  });

  const form = el("form", { className: "login-wrap" });
  const card = el("div", { className: "card login-card" });
  card.append(
    el("h2", {}, "Вхід до FormSite"),
    el(
      "p",
      { className: "hint" },
      "Без підтвердження e-mail. На продакшені — HTTP Basic Auth через Cloudflare.",
    ),
    el("label", { className: "field" }, "Логін", userInput),
    el("label", { className: "field" }, "Пароль", passInput),
  );
  const errNode = el("p", { className: "error" });
  errNode.hidden = true;
  card.append(errNode);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = authService.login(userInput.value.trim(), passInput.value);
    if (!ok) {
      errNode.textContent = "Невірний логін або пароль";
      errNode.hidden = false;
      return;
    }
    setState({ view: "app", error: null });
  });

  card.append(
    el("div", { className: "actions" }, el("button", { type: "submit" }, "Увійти")),
  );
  form.append(card);
  app.append(form);
}

function renderVariantModal(proposals) {
  const backdrop = el("div", { className: "modal-backdrop" });
  const modal = el("div", { className: "modal" });
  modal.append(
    el("h3", {}, "Варіанти заповнення"),
    el(
      "p",
      { className: "sub" },
      "ІІ оцінює, які поля вдалося зіставити з вашими даними. Оберіть макет таблиці.",
    ),
  );

  const list = el("div", { className: "variant-list" });
  for (const p of proposals) {
    const item = el("article", { className: "variant-item" });
    const head = el("header");
    head.append(
      el("strong", {}, p.variantLabel),
      el("span", { className: "badge" }, formatScore(p.score)),
    );
    item.append(head);
    item.append(
      el(
        "p",
        {},
        p.mappings.every((m) => m.value)
          ? "Усі поля шаблону можна заповнити"
          : "Частина полів залишиться порожньою",
      ),
    );
    const ul = el("ul");
    for (const m of p.mappings) {
      const li = el("li", { className: m.value ? "ok" : "miss" });
      li.textContent = m.value
        ? `${m.semantic}: ${m.value} (${Math.round(m.confidence * 100)}%)`
        : `${m.semantic}: — ${m.reason}`;
      ul.append(li);
    }
    item.append(ul);
    const btn = el("button", { type: "button" }, "Згенерувати PDF");
    btn.addEventListener("click", async () => {
      setState({ busy: true, error: null });
      try {
        const pdf = await documentService.generatePdf(
          state.selectedFormId,
          p.variantId,
          state.userData,
        );
        downloadPdf(pdf.fileName, pdf.bytes);
        setState({ modalOpen: false, proposals: null, busy: false });
      } catch (e) {
        setState({
          busy: false,
          error: e instanceof Error ? e.message : "Помилка генерації",
        });
      }
    });
    item.append(el("div", { className: "actions" }, btn));
    list.append(item);
  }
  modal.append(list);
  const close = el("button", { type: "button", className: "secondary" }, "Закрити");
  close.addEventListener("click", () =>
    setState({ modalOpen: false, proposals: null }),
  );
  modal.append(el("div", { className: "actions" }, close));
  backdrop.append(modal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      setState({ modalOpen: false, proposals: null });
    }
  });
  return backdrop;
}

function renderApp() {
  app.innerHTML = "";

  const header = el("header", { className: "site-header" });
  const titleBlock = el("div");
  titleBlock.append(
    el("h1", {}, "FormSite"),
    el("p", {}, "Заповнення форм та генерація PDF"),
  );
  const logout = el("button", { type: "button", className: "secondary" }, "Вийти");
  logout.addEventListener("click", () => {
    authService.logout();
    setState({ view: "login" });
  });
  header.append(titleBlock, logout);

  const dataCard = el("section", { className: "card" });
  dataCard.append(el("h2", {}, "Дані"));
  const grid = el("div", { className: "grid two" });
  for (const meta of FIELD_META) {
    const input = el("input", {
      type: meta.type,
      value: state.userData[meta.key] ?? "",
      id: `field-${meta.key}`,
    });
    input.addEventListener("input", () => {
      state.userData[meta.key] = input.value;
    });
    grid.append(el("label", { className: "field" }, meta.label, input));
  }
  dataCard.append(grid);

  const formCard = el("section", { className: "card" });
  formCard.append(el("h2", {}, "Документ"));
  const select = el("select", { id: "form-select" });
  select.append(el("option", { value: "" }, "— оберіть форму —"));
  for (const f of forms) {
    const opt = el("option", { value: f.id });
    opt.textContent = `${f.title} (${f.category})`;
    if (f.id === state.selectedFormId) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", () => {
    setState({ selectedFormId: select.value });
  });
  formCard.append(el("label", { className: "field" }, "Тип форми", select));

  const genBtn = el("button", { type: "button" }, "Згенерувати PDF");
  genBtn.disabled = state.busy || !state.selectedFormId;
  genBtn.addEventListener("click", async () => {
    if (!state.selectedFormId) return;
    setState({ busy: true, error: null });
    try {
      const proposals = await documentService.getFillOptions(
        state.selectedFormId,
        state.userData,
      );
      setState({ proposals, modalOpen: true, busy: false });
    } catch (e) {
      setState({
        busy: false,
        error: e instanceof Error ? e.message : "Помилка",
      });
    }
  });

  formCard.append(el("div", { className: "actions" }, genBtn));

  const layout = el("div", { className: "layout" });
  layout.append(header, dataCard, formCard);

  if (state.error) {
    layout.append(el("p", { className: "error" }, state.error));
  }

  app.append(layout);

  if (state.modalOpen && state.proposals) {
    app.append(renderVariantModal(state.proposals));
  }
}

function render() {
  if (state.view === "login") renderLogin();
  else renderApp();
}

async function bootstrap() {
  forms = await documentService.listForms();
  if (!state.selectedFormId && forms[0]) {
    state.selectedFormId = forms[0].id;
  }
  render();
}

bootstrap();
