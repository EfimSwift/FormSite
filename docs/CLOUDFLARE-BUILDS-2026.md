# Cloudflare Builds (2026 UI) — FormSite

Экран с **Build command / Deploy command** — норма. Не классический «только Pages».

## Поля в Dashboard

| Поле | Значение |
|------|----------|
| Project name | `formsite` (как `name` в wrangler.toml) |
| Build command | *(пусто)* |
| **Deploy command** | `npx wrangler deploy` |
| Path | `/` |
| Non-production deploy command | `npx wrangler deploy` |
| Builds for non-production branches | по желанию |

**Не используйте** `npx wrangler pages deploy` на этом экране — это другой API (Pages project), отсюда были ошибки 10000.

## API token для Builds (Settings → Builds)

Custom token:

- **Account → Workers Scripts → Edit**
- **Account → Account Settings → Read**

Сохранить в Builds → новый push.

## URL после деплоя

`https://formsite.<ваш-subdomain>.workers.dev` (Workers), не обязательно `pages.dev`.

## functions/_middleware.js

Работает на **Pages Git**. На **Workers static assets** Basic Auth из `functions/` может не подключиться. Вход **demo/demo** в приложении остаётся; для защиты всего сайта — **Cloudflare Access** или Pages-проект отдельно.

## Push

GitHub Desktop → push `wrangler.toml` + `.assetsignore` → смотреть Deployments.
