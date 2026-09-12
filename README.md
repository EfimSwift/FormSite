# FormSite

Статичний сайт **без Node.js**: HTML + ES-модули в браузері, PDF через [pdf-lib](https://pdf-lib.js.org/) (CDN), тестові шаблони — Python (stdlib).

## Архітектура

| Шар | Шлях |
|-----|------|
| UI | `js/main.js`, `css/main.css` |
| Сценарії | `js/application/` |
| Доменні порти | задокументовані в README; реалізації в `js/infrastructure/` |
| Каталог форм | `forms/catalog.json` |
| Шаблони PDF | `forms/templates/*.pdf` |

Заміна «ІІ» або PDF-движка — один файл у `js/infrastructure/`, без зміни UI.

## Локально (тільки Python)

```powershell
cd C:\Users\User\Documents\GitHub\FormSite
python tools/generate_sample_forms.py
python tools/fetch_dejavu_font.py
python tools/serve.py
```

Відкрити http://127.0.0.1:8080/ — логін **demo** / **demo** (`js/config.js`).

**PDF офлайн:** бібліотеки в `vendor/`, шрифт — `fonts/DejaVuSans.ttf`:

```powershell
python tools/fetch_dejavu_font.py
```

(один раз при інтернеті; далі можна працювати без мережі, включно з генерацією PDF.)

> ES-модулі та `fetch` потребують HTTP-сервера; подвійний клік по `index.html` не підійде.

## Cloudflare Pages

- **Build command:** *(порожньо)*
- **Output directory:** `/` (корінь репозиторію)
- **Variables:** `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` — захист через `functions/_middleware.js`

Деплой без збірки: у git мають бути `vendor/*`, `forms/templates/*.pdf`, `fonts/DejaVuSans.ttf`.

## Додати форму

1. PDF у `forms/templates/`
2. Запис у `forms/catalog.json` (варіанти + `placements` з координатами)

## Python

`tools/generate_sample_forms.py` — генерація тестових бланків.  
`tools/serve.py` — локальний сервер.
