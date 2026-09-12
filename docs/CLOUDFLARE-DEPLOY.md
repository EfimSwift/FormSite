# Деплой FormSite на Cloudflare

## Почему агент в Cursor «не подключился»

1. **Сеть** — из среды агента запросы к `api.cloudflare.com` не проходят (`Unable to connect to the remote server`). Это ограничение окружения, а не неверный Account ID.
2. **На работе** деплой обычно идёт через **GitHub Actions / CI** (есть интернет + секреты), или агент только **пушит в git**, а Cloudflare забирает сам.
3. **Токен в чат** — неправильно. Только **GitHub Secrets** или переменные CI.

Account ID `5e77f940207783011628f0eb0b05f26b` — формат верный, если он из URL `dash.cloudflare.com/<id>/workers-and-pages`.

---

## Два правильных способа (выберите один)

### A. GitHub Actions (рекомендуется для FormSite)

Уже есть: `.github/workflows/deploy-cloudflare-pages.yml`

1. GitHub → **EfimSwift/FormSite** → **Settings** → **Secrets and variables** → **Actions**
2. Секреты:
   - `CLOUDFLARE_API_TOKEN` — Custom token: **Account → Cloudflare Pages → Edit**
   - `CLOUDFLARE_ACCOUNT_ID` = `5e77f940207783011628f0eb0b05f26b`
3. `git push origin main` → вкладка **Actions** → job **Deploy Cloudflare Pages**

Команда деплоя: `pages deploy . --project-name=formsite`  
**Не** `wrangler deploy` без `[assets]` и **не** пустой deploy command в Workers Builds.

Basic Auth: в Cloudflare Pages → проект **formsite** → **Settings** → **Environment variables**:
`BASIC_AUTH_USER`, `BASIC_AUTH_PASS` (Production).

---

### B. Классический Pages + Git (без wrangler в CI)

1. **Create** → **Pages** → **Connect to Git** → **FormSite**
2. Build command: **пусто**
3. Build output: **`.`**
4. **Нет** поля Deploy command (в отличие от Workers Builds)

Каждый push в `main` деплоит Cloudflare сам. Агенту достаточно **git push**.

---

## Чего избегать (ваша текущая ошибка)

| Настройка | Проблема |
|-----------|----------|
| **Workers Builds** + `npx wrangler deploy` | Worker без entry-point / assets |
| **Retry** после **seed_repo** | `Cannot retry a build that was created with a seed_repo override` |
| Пустой **Deploy command** в Workers Builds UI | `Invalid request body` |
| Seed `FormSite` → `myformsite` | Путаница; лучше Actions или Pages Git напрямую |

Если остаётесь на Workers Builds со статикой, в `wrangler.toml` нужен блок `[assets]` и deploy `npx wrangler deploy` — см. [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/).  
Для FormSite с `functions/_middleware.js` проще **Pages (вариант A или B)**.

---

## Что может делать агент без Cloudflare API

- Править код, делать **commit + push** → срабатывает Actions (вариант A) или Pages Git (вариант B).
- Не требовать токен в чате.

## Что нужно для прямого API/wrangler с машины пользователя

- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` в **локальной** консоли или Secrets.
- Рабочий интернет до Cloudflare.

Скрипт: `tools/cloudflare-setup-pages.ps1` (опционально).

---

## Документация Cloudflare

- [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Direct Upload + CI (wrangler-action)](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) — другой продукт, не путать с классическим Pages.
