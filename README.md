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
| `npm run lint`         | ESLint                                                            |
| `npm run format`       | Prettier (write)                                                  |
| `npm run format:check` | Prettier (check; used in CI)                                      |
| `npm run typecheck`    | `tsc --noEmit`                                                    |

> The page stylesheet is **compiled**, not loaded from a CDN: run `npm run build` (or `npm run build:css`)
> before `npm start`, otherwise the CSS 404s. `public/css/` is generated and not tracked in git.

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
  services/pdfLayout.ts              PDF layout constants & page-break helpers
  services/invoiceNumber.ts          INV-YYYY-NNNN numbering
  middleware/errorHandler.ts         terminal JSON error handler
  utils/catchAsync.ts                async error wrapper
  utils/round2.ts                    money rounding
  utils/sanitize.ts                  PDF-safe text sanitization
  interfaces/index.ts                shared types
views/
  index.ejs                          thin shell (links scripts, includes partials)
  partials/
    head.ejs                         meta, theme boot, fonts, stylesheet
    header.ejs                       title, EN/FR + theme controls
    form.ejs                         the document form
    toasts.ejs                       success/error live regions
public/
  css/app.css                        compiled stylesheet (generated, gitignored)
  js/theme-boot.js                   pre-paint theme (no FOUC)
  js/app.js                          form behaviour (i18n, totals, submit)
tests/                               Vitest suite (API, frontend, security, logging)
```

## Notes

- `dist/` is generated by `npm run build` and is not tracked in git.
- `public/css/` is generated by `npm run build:css` and is not tracked in git.
