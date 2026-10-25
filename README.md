# pdfInvoice

An Express + TypeScript service that generates invoice/document PDFs from a web form using [PDFKit](https://pdfkit.org/).

Fill in the form at `GET /`, and the browser POSTs the data as JSON to `POST /pdf/invoice-generate`, which streams back a generated PDF.

## Requirements

- Node.js 18+ (developed against Node 20/22)
- npm

## Setup

```bash
npm install
cp .env.example .env   # optional; defaults are used if absent
```

## Scripts

| Script                 | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | Start with nodemon + ts-node (auto-reload)                        |
| `npm run build`        | Build the stylesheet **and** compile TypeScript `src/` → `dist/`  |
| `npm run build:css`    | Compile `src/styles/app.css` → `public/css/app.css` (Tailwind v4) |
| `npm start`            | Run the compiled server (`node dist/index.js`)                    |
| `npm test`             | Run the test suite (Vitest)                                       |
| `npm run samples:pdf`  | Generate the 30-PDF QA matrix in `/tmp/pdf-samples`               |
| `npm run lint`         | ESLint                                                            |
| `npm run format`       | Prettier (write)                                                  |
| `npm run format:check` | Prettier (check; used in CI)                                      |
| `npm run typecheck`    | `tsc --noEmit`                                                    |

> The page stylesheet is **compiled**, not loaded from a CDN: run `npm run build` (or `npm run build:css`)
> before `npm start`, otherwise the CSS 404s. `public/css/` is generated and not tracked in git.

> **Mobile**: below 768px the item editor becomes stacked, labeled blocks (no horizontal scroll),
> and the submit button lives in a sticky bottom action bar carrying the running total.

## Environment variables

| Variable    | Default            | Description                                    |
| ----------- | ------------------ | ---------------------------------------------- |
| `PORT`      | `8000`             | HTTP port the server listens on                |
| `DOMAIN`    | `http://localhost` | Base URL shown in the startup log              |
| `LOG_LEVEL` | `info`             | Pino log level (`silent` when `NODE_ENV=test`) |
| `LOG_FILE`  | _(unset)_          | Write JSON logs to this file instead of stdout |

See [`.env.example`](.env.example).

## API

### `GET /`

Renders the invoice form.

### `POST /pdf/invoice-generate`

Accepts a JSON body and responds with a PDF (`Content-Type: application/pdf`).

Example body:

```json
{
  "documentType": "SERVICE INVOICE",
  "company": {
    "name": "Acme",
    "address": "1 Main St",
    "city": "NY",
    "phone": "123",
    "email": "a@b.com"
  },
  "client": {
    "name": "Bob",
    "address": "2 Oak St",
    "city": "LA",
    "phone": "456",
    "email": "c@d.com"
  },
  "issueDate": "2026-01-01",
  "dueDate": "2026-01-31",
  "items": [{ "description": "Widget", "quantity": 2, "price": 10 }],
  "paymentType": "Bank Transfer",
  "notes": "Thank you!",
  "taxRate": 10,
  "currency": "USD"
}
```

Responses:

- `200` — PDF stream
- `400` — JSON `{ "errors": [{ "path": "...", "msg": "..." }] }` for validation failures, or `{ "error": "Malformed JSON body" }`
- `403` — cross-origin requests are rejected (same-origin only)
- `413` — payload larger than 200 KB
- `429` — more than 10 requests/minute to `/pdf`

> Required fields: `documentType`, `company.name`, `client.name`, `issueDate`, `items[].description`/`price`/`quantity`, `taxRate`, `currency`. Everything else is optional. Text fields are capped (description ≤ 1000 chars, notes ≤ 2000, names ≤ 200).

### `GET /health`

Liveness probe: `200 { "status": "ok", "uptime": <seconds> }`. Not rate limited and excluded from access logs.

## Docker

```bash
docker build -t pdfinvoice .
docker run -p 8000:8000 pdfinvoice
```

Multi-stage build; the runtime image contains production dependencies only and runs as the unprivileged `node` user. A `HEALTHCHECK` polls `GET /health`.

## Security & operations

- **Helmet** security headers with a CSP tuned for the page (local stylesheet + Google Fonts — no CDN)
- **Same-origin only**: requests with a foreign `Origin` header get `403`
- **Rate limiting** on `/pdf` (10/min/IP) and a **200 KB JSON body limit**
- **PDF-safe input handling**: control characters stripped, length caps enforced; text is _not_ HTML-escaped (`O'Brien` stays `O'Brien`)
- **Structured JSON logs** (pino) with a request id per line, validation-failure details and PDF generation timing
- **Graceful shutdown**: `SIGTERM`/`SIGINT` drain in-flight requests (10s failsafe)

## Project structure

```
src/
  index.ts                           app entry (listen, graceful shutdown)
  app.ts                             Express setup (security, static assets, routes)
  logger.ts                          pino logger
  styles/app.css                     Tailwind v4 entry + design tokens
  routes/invoiceRoute.ts             /pdf routes
  controllers/invoiceController.ts   PDF generation
  validations/pdfInputValidations.ts request validation rules
  services/pdfLayout.ts              PDF layout tokens & document-type metadata
  services/invoiceModel.ts           normalised render model (lines, dates, totals)
  services/pdfRenderer.ts            PDFKit drawing (header, table, ledger, footer)
  services/i18n.ts                   server-side translation lookup
  services/currency.ts               locale-aware money and date formatting
  services/invoiceNumber.ts          INV-YYYY-NNNN numbering
  middleware/errorHandler.ts         terminal JSON error handler
  utils/catchAsync.ts                async error wrapper
  utils/round2.ts                    money rounding
  utils/sanitize.ts                  PDF-safe text sanitization
  interfaces/index.ts                shared types
  locales/en.ts, fr.ts               EN/FR dictionaries (parity-tested)
views/
  index.ejs                          thin shell (links scripts, includes partials)
  partials/
    head.ejs                         meta, theme boot, fonts, stylesheet
    header.ejs                       title, EN/FR + theme controls
    form.ejs                         the document form
    toasts.ejs                       success/error live regions
    sheet.ejs                        live A4 sheet + preview overlay
public/
  css/app.css                        compiled stylesheet (generated, gitignored)
  js/theme-boot.js                   pre-paint theme (no FOUC)
  js/app.js                          form behaviour (i18n, totals, submit)
scripts/
  pdf-samples.ts                     QA PDF matrix generator
tests/                               Vitest suite (API, renderer, frontend, security, logging)
  helpers/pdf.ts                     PDF text/page-count helpers
```

## PDF architecture

The PDF is the printed twin of the live A4 sheet. A request keeps the controller thin:

```
POST /pdf/invoice-generate
  → invoiceController: validate → assign number → discard client totals
  → invoiceModel: normalise lines/dates/payment/notes, compute subtotal/tax/total
  → pdfRenderer: draw header, table, ledger, closing blocks and footer
  → stream PDF to the response
```

- **`src/services/pdfLayout.ts`** — print tokens: A4 grid, paper/ink colours, standard fonts, type
  scale, spacing, table columns, and totals/notes/footer dimensions. It also maps each
  `documentType` to its title, id-label and date-label translation keys. These tokens mirror the
  paper/ink tokens in `src/styles/app.css`; update both together.
- **`src/services/invoiceModel.ts`** — pure, testable model. It indexes lines, computes
  `quantity × price`, rounds the subtotal/tax/total once at the money boundary, and selects the
  primary/secondary dates per document type. Client-supplied `subtotal`/`total` never reach it.
- **`src/services/pdfRenderer.ts`** — PDFKit drawing. Every label comes from `t(key, lang)`; every
  value from `formatMoney`/`formatDate`. It draws one accent top rule, hairline-separated sections,
  the five-column table, a totals ledger that is measured before drawing, optional payment/notes
  blocks, and the footer.
- **`src/controllers/invoiceController.ts`** — validation, invoice number, model, response headers
  and streaming. It does not calculate or format money.

### Design rules

- One accent (`#9E2B25`): top rule, section labels and grand total only. Everything else is
  ink/ink-soft/rules on white paper.
- No boxes, fills, shadows or icons; hairlines separate sections.
- Every supplied party/contact/date/payment/notes field is printed. Empty optional fields are
  omitted; `undefined`, `null` and `NaN` must never appear.
- Money is right-aligned and locale-aware; dates follow the document language.
- The totals ledger is reserved before drawing so it never splits. Long tables repeat the table
  header and a compact continuation header.
- The footer rule and `Page X of Y` appear on every page; thanks/contact copy only on the last page.
- Standard PDFKit fonts only. Embedded fonts would break `tests/helpers/pdf.ts`; the migration is
  gated behind the optional P9 chunk.

### Preview the PDF samples

```bash
npm run samples:pdf
# → /tmp/pdf-samples: 30 PDFs, manifest.json, baseline-3-items.txt, baseline payload
PDF_SAMPLES_DIR=/tmp/my-samples npm run samples:pdf   # override the output directory
```

The matrix is 4 document types × EN/FR × 1/3/15 items (24 PDFs), plus six variants: payment/notes,
required-only, FR + MAD, JPY, long party names, and zero tax + EUR. `manifest.json` records page
counts, byte sizes, currencies and which optional fields each sample covers. Open the PDFs in a
viewer for visual QA; the baseline text dump is a regression reference for the canonical 3-item
invoice.

### Add a PDF string or locale key

1. Add the key to `Dictionary` and the `en` object in `src/locales/en.ts`.
2. Add the same key to `src/locales/fr.ts` (TypeScript and the parity test enforce this).
3. Resolve it in `pdfRenderer.ts` with `t('pdf.key', model.lang)`; keep it in reading order.
4. Add or update the assertion in `tests/i18n.test.ts` and, when rendered, `tests/api.test.ts`.
5. Run `npm test`, `npm run lint`, `npm run format:check` and `npm run samples:pdf`.

## Frontend architecture (chunk R8)

The UI was redesigned to a compiled, partialised, token-driven build.

- **Source styles:** `src/styles/app.css` uses Tailwind v4 (`@import "tailwindcss"`), `@source` paths for `views/` and `public/js/`, a dark-mode `@custom-variant`, and design tokens under `@theme` (paper/ink/rule/accent/ledger). Utilities like `.money` use `font-variant-numeric: tabular-nums`.
- **Source scripts:** `public/js/theme-boot.js` runs blocking in `<head>` to avoid FOUC; `public/js/app.js` (IIFE, no bundler) handles i18n, totals, the live A4 sheet, validation mapping, and the success flow.
- **Templates:** `views/index.ejs` is a thin shell that includes `views/partials/{head,header,form,sheet,toasts}.ejs`. The sheet is rendered client-side from `collectData()` and scaled with `ResizeObserver` (jsdom-safe).
- **Assets:** `express.static('public')` serves compiled CSS/JS. `public/css/` is generated by `npm run build:css` and is not tracked in git.
- **i18n:** Dictionaries live in `src/locales/{en,fr}.ts` (parity enforced by tests). The browser loads them via `GET /i18n.js` and `applyLang()` re-translates static, placeholder/aria, dynamic labels (items/counter), the sheet and the success panel.
- **Add a class:** add it to templates or JS strings — Tailwind's `@source` directives will include classes found under `views/` and `public/js/`. Rebuild with `npm run build:css`.
- **Add copy/i18n:** add keys to both `src/locales/en.ts` and `src/locales/fr.ts` (the `Dictionary` type enforces parity), add `data-i18n` / `data-i18n-ph` / `data-i18n-aria` in templates or call `tUi()` in JS, rebuild and update tests.
- **Fresh clone:** `npm ci && npm run build && npm start`. If you skip the build, `/css/app.css` will 404 (see notes above).

## Notes

- `dist/` is generated by `npm run build` and is not tracked in git.
- `public/css/` is generated by `npm run build:css` and is not tracked in git.
