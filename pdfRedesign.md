# PDF Redesign Plan — pdfInvoice

**Scope:** visual + structural redesign of the server-generated PDF (PDFKit), keeping the API,
validation, i18n and response headers unchanged.
**Date:** 2026-10-25 · **Status:** proposed · not started
**Skills used:** `frontend-design`, `ui-ux-pro-max`

Work top to bottom. Each **chunk** is a small, independently verifiable unit.
A chunk is done only when its **Verify:** line passes. Tick boxes as you go.

---

## 1. Context

The PDF is rendered by `src/controllers/invoiceController.ts` with constants from
`src/services/pdfLayout.ts`. It works, but it is visually behind the web app:

- Header is a blue/amber/green title, a hard-coded two-column block, and a **grey “BILL TO” box**
  (`rect(...).fill('#e0e0e0')`) — the only filled shape in the product.
- Items table has **3 columns** (description, quantity, price). It prints the *unit price* under an
  “AMOUNT” heading, so the customer never sees a line total or a subtotal.
- `paymentType` and `notes` are collected by the form and shown in the live HTML preview, but are
  **not printed in the PDF at all**.
- `dueDate` is only used as the primary date for quotes; invoices never print it.
- Footer is a bracketed debug-looking line: `[Acme, 555, a@b.com]`.
- One accent per document type (`#2563eb`, `#d97706`, `#059669`) conflicts with the app’s locked
  “paper & ink” system (one oxblood accent `#9E2B25`).
- The live A4 preview (`views/partials/sheet.ejs` + `renderSheetMarkup()` in `public/js/app.js`)
  already speaks the paper/ink language: serif title, hairlines, tabular numbers, no cards.
  The PDF should be the printed version of that same document.

### Hard constraints (test-covered)

- `tests/api.test.ts` asserts PDF text: company/client/item names, `Tax (10%)`, totals,
  `INVOICE #` / `QUOTE #` / `RECEIPT #`, `DATE:` / `VALID UNTIL:` / `PAID ON:`,
  `Bill To` in FR (`FACTURER À`), `Page X of Y`, thanks/contact copy, multi-page behaviour,
  company name repeated on continuation pages, and no `undefined` / no client-supplied total.
- `tests/helpers/pdf.ts` extracts text by inflating streams and decoding `<hex>` tokens.
  **It only works with PDFKit’s standard fonts.** Proven experimentally: embedding a TTF makes
  text come out as glyph IDs. Any font embedding must be paired with a new extractor (chunk P9).
- `src/locales/en.ts` + `fr.ts` must stay in parity (`tests/i18n.test.ts`); every new PDF string
  needs keys in both.
- `formatMoney` / `formatDate` own locale-aware currency and dates. Do not format money ad hoc.
- Server-side totals, rounding (`round2`), invoice-number header and streaming must not change.

---

## 2. Design direction

Subject grounding: **paper documents and ledgers** — letterhead, ruled tables, stamped totals.
This is a print artifact, not a dashboard. The redesign should feel like a well-set statement
from a design studio, not a generic SaaS invoice template.

`ui-ux-pro-max` returned *Trust & Authority* + *Swiss Minimalism* for this product: strict grid,
hairlines, high contrast, sans-serif data. Its suggested navy + paid-green palette was **rejected**
because the app already has a deliberate, accessible paper/ink/oxblood system; a second palette
would make the PDF and the preview feel like two products. Its typography result (`IBM Plex Sans`,
“Financial Trust”) confirms the body face already used by the app. Number-formatting guidance
(thousand separators, aligned figures) is applied throughout.

`frontend-design` discipline: spend boldness in one place (the totals ledger), keep everything else
quiet; hairlines instead of cards; no gradients, shadows, boxes or decorative icons; no fake stamp.

### Colour tokens (mirrored from `src/styles/app.css`)

| Token | Value | Use |
|---|---|---|
| `paper` | `#FFFFFF` | page background (paper stays paper) |
| `ink` | `#1A1F26` | primary text, title, table body |
| `inkSoft` | `#5C6673` | contact lines, meta labels, table headers, footer |
| `rule` | `#E5E3DC` | hairlines between rows/sections |
| `accent` | `#9E2B25` | top rule, section labels, grand total; nothing else |

Contrast on white: ink **16.6:1**, inkSoft **5.8:1**, accent **7.4:1** — all pass AA for their sizes.

### Typography (v1, standard PDFKit fonts)

| Role | Font | Size / leading | Notes |
|---|---|---|---|
| Document title | `Times-Bold` | 30 / 32 | Spectral stand-in; uppercase from dictionary; tracking `0.6` |
| Company name | `Helvetica-Bold` | 12 / 15 | |
| Client name | `Helvetica-Bold` | 10.5 / 14 | |
| Section label | `Helvetica-Bold` | 7.5 / 9 | uppercase, tracking `1.2`, accent or inkSoft |
| Meta label | `Helvetica-Bold` | 7.5 / 9 | uppercase, tracking `0.9`, inkSoft |
| Meta value | `Helvetica` | 9 / 11 | right-aligned, tabular figures |
| Table header | `Helvetica-Bold` | 7.5 / 9 | uppercase, tracking `0.8`, inkSoft |
| Table body | `Helvetica` | 9 / 12 | description left, numbers right |
| Grand total | `Helvetica-Bold` | 13 / 15 | accent |
| Footer | `Helvetica` | 7.5 / 10 | inkSoft |

`FONTS` is a single map in `pdfLayout.ts`, so chunk P9 can swap in IBM Plex Sans + Spectral
without touching layout code. Helvetica digits have uniform widths, so money columns stay aligned.

### Page grid

A4 `595.28 × 841.89 pt`. Margin **56 pt** left/right/top; content bottom **`page.height − 56 − 40`**
(40 pt reserved for the footer). Content width **483.28 pt**.

```
┌──────────────────────────────────────────────────────┐
│▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ (3pt accent) │
│ FROM                          INVOICE                │
│ Northwind Studio              INV-2026-0001          │
│ 14 Rue des Lilas              DATE:  Oct 24, 2026    │
│ 75011 Paris                   DUE DATE: Nov 23, 2026 │
│ +33 … · hello@…                                      │
│ ──────────────────────────────────────────────────── │
│ BILL TO                                              │
│ Atelier Moreau                                       │
│ 8 Quai Saint-Vincent                                 │
│ 69001 Lyon · +33 … · compta@…                        │
│ ──────────────────────────────────────────────────── │
│ #   DESCRIPTION              QTY   UNIT   AMOUNT     │
│ ──────────────────────────────────────────────────── │
│ 01  Brand identity system      1  2,400.00  2,400.00 │
│ 02  Editorial layout …         2    850.00  1,700.00 │
│ ──────────────────────────────────────────────────── │
│                                SUBTOTAL   4,100.00   │
│                                TAX 20%      820.00   │
│                                ────────────────────  │
│                                TOTAL      4,920.00   │
│ PAYMENT METHOD            NOTES                       │
│ Bank transfer — 30 days   Thank you …                 │
│ ──────────────────────────────────────────────────── │
│ Thank you for your business!          Page 1 of 1     │
│ Northwind Studio · +33 … · hello@…                    │
└──────────────────────────────────────────────────────┘
```

### Table columns

| Column | x | width | align |
|---|---:|---:|---|
| `#` | 56 | 20 | left |
| Description | 84 | 220 | left |
| Qty | 312 | 36 | right |
| Unit price | 360 | 76 | right |
| Line amount | 448 | 91.28 | right |

Totals block: width **210**, right-aligned to content edge. Rule above `TOTAL`.

### Tailoring per document type

| Type | Title | Primary date | Secondary date |
|---|---|---|---|
| Service invoice | `INVOICE` | `DATE` = issueDate | `DUE DATE` = dueDate (only if present) |
| Product invoice | `INVOICE` | `DATE` = issueDate | `DUE DATE` = dueDate (only if present) |
| Quote | `QUOTE` | `VALID UNTIL` = dueDate | `DATE` = issueDate; if no dueDate, primary is `DATE` = issueDate |
| Receipt | `RECEIPT` | `PAID ON` = issueDate | — |

All four share one layout and one accent. Difference is language, not decoration.

### Principles

1. Paper & ink: hairlines, no fills, no boxes, no shadows, no icons. One accent.
2. One memorable element: the right-aligned totals ledger with a heavy rule and an accent total.
3. Every payload field the form collects is represented: issue/due dates, both parties and all
   their contact fields, line item numbers, unit price, line amount, subtotal, tax, total,
   payment method, notes.
4. Empty optional fields are omitted; the words `undefined`, `null` or `NaN` must never print.
5. Money right-aligned with thousand separators and currency-correct decimals; dates localised.
6. Pagination is invisible when unnecessary and obvious when needed: repeated table header,
   continuation header, `Page X of Y`, totals never split.

---

## 3. File map

| File | Change |
|---|---|
| `src/services/pdfLayout.ts` | Tokens (`PAGE`, `COLORS`, `FONTS`, `TYPE`, `SPACE`, `COLUMNS`), document-type metadata; remove per-type accents |
| `src/services/invoiceModel.ts` | **new** — pure line/total/date model, one source for the renderer and tests |
| `src/services/pdfRenderer.ts` | **new** — drawing primitives + full document renderer |
| `src/controllers/invoiceController.ts` | thin: validate → number → model → render → stream → log |
| `src/locales/en.ts`, `src/locales/fr.ts` | new `pdf.*` keys |
| `tests/api.test.ts` | updated + new PDF content assertions |
| `tests/invoiceModel.test.ts` | **new** — totals, lines, date selection |
| `tests/i18n.test.ts` | assertions for new FR labels |
| `scripts/pdf-samples.ts` | **new** — writes the QA matrix to `/tmp/pdf-samples` |
| `package.json` | `samples:pdf` dev script |
| `README.md` | PDF architecture + how to preview samples |
| `Dockerfile` | only chunk P9 (font assets) |

**Not touched:** `views/`, `public/js/app.js`, CSP, validation rules, API contract, response headers.
The live preview remains the HTML twin; aligning its column labels is a separate follow-up.

---

## 4. Chunks

### Chunk P0 — Baseline, samples and guardrails ✅
- [x] Run `npm test`, `npm run lint`, `npm run format:check`, `npm run build`; record the green baseline
- [x] Add `scripts/pdf-samples.ts`: boots `src/app` via `supertest`, writes a matrix to `/tmp/pdf-samples`
      — 4 document types × EN/FR × (1 item / 3 items / 15 long items) — plus variants with
      payment + notes, without optional fields, and with `MAD`/`JPY`
- [x] Add `"samples:pdf": "ts-node --transpile-only scripts/pdf-samples.ts"` to `package.json`
- [x] Save baseline extracted text for the 3-item sample (`tests/helpers/pdf.ts`) as a local reference
- [x] List the test hooks in §1 in the PR/notes so later chunks do not silently drop them

**Verify:** baseline green; `npm run samples:pdf` writes PDFs; the 3-item baseline text dump is
recorded and can be diffed after the no-visual-change refactor.

> Verified: **153/153 tests**, lint and build green. `format:check` started red on three
> pre-existing files (`public/js/app.js`, `src/controllers/invoiceController.ts`, `src/locales/en.ts`);
> fixed with Prettier only (wrapping/whitespace, no logic changes) and re-checked green.
> `npm run samples:pdf` writes **30 PDFs** to `/tmp/pdf-samples` — 24 matrix (4 types × EN/FR ×
> 1/3/15 items) + 6 variants (payment+notes, required-fields-only, FR+MAD, JPY, long names,
> zero tax). All are valid PDFs; every 15-item sample is 3 pages. Also writes `manifest.json`,
> `baseline-3-items.txt` (invoice number normalised to `INV-YYYY-NNNN`), and
> `baseline-3-items.payload.json`; the dump is byte-identical across reruns.
> Pre-P1 snapshot: `/tmp/pdf-baseline-pre-p1.txt` (+ `.payload.json` and `.pdf`).
> Test hooks preserved for later chunks: `Tax (10%)`, `INVOICE #` / `QUOTE #` / `RECEIPT #`,
> `DATE:` / `VALID UNTIL:` / `PAID ON:`, `Page X of Y`, thanks/contact copy, FR `FACTURER À` /
> `Quantité` / `MONTANT` / `Taxe` / `Page 1 sur 1`, multi-page continuation header + repeated
> company name, no `undefined`, no client-supplied total, server-side rounding, 15-item cap,
> `X-Invoice-Number`, and the standard-font-only constraint in `tests/helpers/pdf.ts` (P9 must
> migrate the extractor before any font embedding).

---

### Chunk P1 — Extract the model and renderer (no visual change) ✅
- [x] `src/services/invoiceModel.ts`: `buildInvoiceModel(data)` returns
      `{ lang, currency, style, number, company, client, issueDate, dueDate, primaryDate,
      secondaryDate, lines, subtotal, taxValue, taxRate, grandTotal, paymentType, notes }`.
      Lines are `{ index, description, quantity, price, amount }` with `amount = quantity * price`.
      Use `round2` exactly as today: `subtotal = round2(sum)`, `tax = round2(subtotal * rate / 100)`,
      `grand = round2(subtotal + tax)`.
- [x] Date selection lives in the model, not the renderer:
      invoice `DATE` + optional `DUE DATE`; quote `VALID UNTIL` + `DATE` (fallbacks as §2);
      receipt `PAID ON` only.
- [x] `src/services/pdfRenderer.ts`: move the existing drawing code verbatim into
      `renderInvoicePdf(doc, model, data)`; no layout changes yet.
- [x] Controller keeps validation, `delete data.subtotal/total`, invoice number, filename,
      `X-Invoice-Number`, `doc.pipe(res)`, timing log; body becomes model + render + `doc.end()`.
- [x] Add `tests/invoiceModel.test.ts` (totals, rounding traps, lines, date selection, empty optionals).

**Verify:** `npm test` green; the extracted text of the 3-item sample is **identical** to P0;
`npm run build` green. This chunk must not change the PDF visually.

> Verified: **170/170 tests** (153 existing + 17 model tests), build, lint and format green.
> The 3-item extracted-text dump is byte-identical to the pre-P1 snapshot
> (`diff -u /tmp/pdf-baseline-pre-p1.txt /tmp/pdf-samples/baseline-3-items.txt` → empty). A P0
> worktree (`c0c8b83`) regenerated the full matrix; **all 30 PDFs** have identical extracted text and
> page counts before vs after (22 one-page, 8 three-page).
> Implementation notes:
> - The model returns semantic date lines (`{ value, role: 'issue' | 'due' }`), so P2 can choose
>   labels without re-deriving document-type rules. P1 keeps today's primary label exactly as-is;
>   the quote-without-due-date case still prints `VALID UNTIL` with the issue date until P2 fixes it.
> - `DocumentTypeStyle` gained `kind: 'invoice' | 'quote' | 'receipt'`; this is metadata only, no
>   colour or layout change.
> - The renderer takes `(doc, model)` rather than `(doc, model, data)` — the model is the complete
>   render input, so passing the raw request data again would be redundant.
> - Controller is now request handling + model + render + `doc.end()`; all coordinates, fonts,
>   colours and text order moved unchanged into the renderer.

---

### Chunk P2 — Grid, tokens, header and bill-to ✅
- [x] Add `PAGE`, `COLORS`, `FONTS`, `TYPE`, `SPACE`, `COLUMNS` to `pdfLayout.ts` from §2
- [x] Replace `DOCUMENT_TYPES.accent` with title/id/date metadata only; delete per-type colours
- [x] Top-of-page **3 pt accent rule**, full bleed
- [x] `FROM` micro-label + company name + non-empty contact lines (`address`, `city`, `phone`, `email`
      one per line, matching the live sheet); inkSoft for contact lines
- [x] Right meta block: serif title (`Times-Bold`, 30 pt), `INVOICE #` label + number,
      primary date row, optional secondary date row; right-aligned, tabular figures
- [x] Hairline under the header block (rule colour)
- [x] `BILL TO` accent micro-label + client name + non-empty contact lines; **delete the grey box**
- [x] Dynamic vertical cursor based on measured header/bill-to heights (no hard-coded `140`, `270`)
- [x] Keep the old items/totals code temporarily so the rest of the tests stay green

**Verify:** `npm test` green (doc-type/FR assertions unchanged); samples show the new header,
no grey box, one accent; no text overlap in the header at long company/address names.

> Implementation notes:
> - The header and bill-to blocks are measured with `heightOfString`; the items table starts from
>   that cursor (276.6 pt on the 3-item sample) rather than the old hard-coded 270.
> - Contact fields are stacked one per line instead of middot-joined. This matches the live sheet,
>   avoids long-line wrapping, and omits empty fields entirely.
> - Added `pdf.from` (`FROM` / `ÉMETTEUR`) and `pdf.dueDate` (`DUE DATE` / `DATE D'ÉCHÉANCE`).
>   Quote-without-due now prints `DATE` rather than `VALID UNTIL` against the issue date.
> - Top rule is repeated on continuation pages so every page has the same edge.
> - The controller page margin moved from 50 to 56; the legacy items/totals/footer code remains
>   unchanged and still uses `LAYOUT` until P3–P5.
> - Verification: 172/172 tests (added quote-without-due and invoice-with-due label tests),
>   build/lint/format green; 30 samples regenerated (22 one-page, 8 three-page); accent present
>   in all 30, grey box and old blue/amber/green absent from all 30. Long-name sample: name wraps
>   inside 250 pt, left column ends at x 306, meta column starts at x 329.28 — no overlap.

---

### Chunk P3 — Items table: 5 columns, numbering, hairlines, pagination ✅
- [x] Draw the table header from `COLUMNS` (§2): `#`, `DESCRIPTION`, `QTY`, `UNIT PRICE`, `AMOUNT`
- [x] Row number `01…15` in inkSoft; description left; qty, unit price, line amount right
- [x] Row height = `max(22, heightOfString(description, width) + 14)`; hairline under every row
- [x] Page break: `addPage()` → continuation header (company left, title + number right + hairline)
      → repeat table header → reset cursor
- [x] Ensure a row is never split by a page break; measure before drawing
- [x] Empty description fallback: an em dash, never blank overlap
- [x] Remove the old 3-column drawing and `cursorY` arithmetic

**Verify:** 15 multi-line rows produce >1 page and contain every `ITEM_01…ITEM_15`; a long
description wraps in full; `countPdfPages` >1; money values match `formatMoney`; sample review.

> Implementation notes:
> - `COLUMNS` is now the single source for header and row x/width/alignment. Header labels are
>   `#`, `DESCRIPTION`, `QTY`, `UNIT PRICE`, `AMOUNT` (`QTÉ`, `PRIX UNITAIRE` in French).
> - Rows are measured before drawing (`heightOfString + 14`, floor 22) and are never split. The
>   bottom hairline is part of each row; numbers are top-aligned with the first description line.
> - Continuation pages: 10 pt company name left, 12 pt serif title + 9 pt number right, hairline
>   at 76 pt, repeated table header at 94 pt.
> - Legacy totals/footer still follow the last row; P4/P5 replace them. `LAYOUT` now only holds
>   the remaining totals/footer constants.
> - Verification: 173/173 tests (added table header/numbering/unit-price/line-amount test);
>   build/lint/format green; 30 samples regenerated (22 one-page, 8 three-page). The 15-row
>   sample splits 5/7/3 rows across three pages, contains every `ITEM_01…ITEM_15`, and repeats
>   the table header. Long descriptions wrap inside the 220 pt column; x-geometry leaves an
>   8 pt gap before the qty column and no header/row overlap.

---

### Chunk P4 — Totals ledger ✅
- [x] Right-aligned 210 pt block: `SUBTOTAL`, `Tax (rate%)`, hairline, `TOTAL`
- [x] Subtotal is a **new row** (today it is missing from the PDF)
- [x] Grand total: accent, `Helvetica-Bold` 13 pt; label and value on the same baseline
- [x] Reserve the whole block before drawing; if it does not fit, start a continuation page
      (never split the ledger across pages)
- [x] Keep the exact text `Tax (10%)` / `Taxe (10%)` and `TOTAL`; keep `formatMoney` output
      (`22.00 $`, `1.234,50 dh`, `1,234 ¥`)

**Verify:** existing rounding tests green; new assertion for the subtotal; sample shows a single
unbroken ledger; total is the strongest element after the title.

> Implementation notes:
> - `TOTALS` owns the 210 pt block width, row heights, rule gaps and the full reserved height.
>   The ledger is pinned to the right content edge, with labels on the left and values
>   right-aligned.
> - Subtotal is a new row using the new `pdf.subtotal` key (`SUBTOTAL` / `SOUS-TOTAL`). The tax
>   row keeps the exact `Tax (10%)` / `Taxe (10%)` shape, and `formatMoney` owns every amount.
> - The ledger is reserved with `ensureSpace(..., TOTALS.height)` before drawing, so it moves to
>   a continuation page as one block and never splits. The grand total uses `TYPE.grandTotal`
>   (Helvetica-Bold 13 pt) in the accent colour, with label and value on the same baseline.
> - Verification: 175/175 tests (added subtotal/ledger assertions), build/lint/format green;
>   30 samples regenerated (22 one-page, 8 three-page). Text diff against P3 samples contains
>   only the inserted `SUBTOTAL` / `SOUS-TOTAL` row; 15-item samples keep the whole ledger on the
>   final page.

---

### Chunk P5 — Payment, notes, footer, page numbers ✅
- [x] Payment block: `PAYMENT METHOD` accent label + wrapped value; only when `paymentType`
- [x] Notes block: `NOTES` accent label + wrapped value; only when `notes`
- [x] If both exist, place side-by-side in two 230 pt columns; otherwise one full-width block
- [x] Reserve their height; if needed, start a continuation page (never orphan a label)
- [x] Footer hairline near the bottom: thanks + contact line on the left, `Page X of Y` on the right
- [x] Footer contact line joins only non-empty `company.name`, `phone`, `email` with ` · `;
      remove the bracketed `[Acme, …, …]` form
- [x] Continuation pages: company name repeats in the header (test relies on ≥2 mentions);
      thanks/contact copy at least on the final page
- [x] Stamp page numbers across all buffered pages via `bufferedPageRange`, without spilling a page

**Verify:** multi-page test still finds `Page 1 of N` and `Page N of N`; company name appears ≥2
times; payment/notes appear when supplied and are absent when empty; no `undefined`; FR sample
shows translated labels; no footer/content overlap.

> Implementation notes:
> - Payment and notes are built from trimmed model values, so blank/whitespace-only fields print
>   nothing. Labels come from the new `pdf.payment` / `pdf.notes` keys; both blocks use the
>   accent section label and a wrapped 9 pt value.
> - When both exist they sit in two 230 pt columns (23.28 pt gap); a lone block spans the full
>   content width. Each block is measured with `heightOfString` and reserved via `ensureSpace`
>   before drawing, so a label is never orphaned at the bottom of a page.
> - The footer strip uses `FOOTER` tokens: a rule at the content bottom, 9 pt thanks and 7.5 pt
>   contact copy on the left, and a right-aligned page number on the thanks line. The contact line
>   joins only non-empty company name/phone/email with ` · `; the old bracketed form is gone, and
>   overlong lines are collapsed/truncated to a single line with an ellipsis.
> - Page numbers are stamped on every buffered page with `bufferedPageRange`, temporarily
>   disabling the bottom margin so stamping cannot spill a page. Thanks/contact copy appears only
>   on the final page; the rule and page number appear on every page. Legacy `LAYOUT` code was
>   removed.
> - Added `pdf.payment` / `pdf.notes` in EN/FR and extended the FR MAD sample with payment/notes.
>   Also hardened `tests/helpers/pdf.ts` to slice streams by `/Length`: the new footer text exposed
>   a latent delimiter-regex bug when compressed data ended in a CR byte.
> - Verification: 178/178 tests (payment/notes presence and absence, FR labels, footer contact
>   line, bracket removal), build/lint/format green; 30 samples regenerated (22 one-page,
>   8 three-page); 440 structural sample checks pass, including page numbers on every page,
>   thanks/contact only on the final page, FR labels, an unbroken ledger, and no `undefined`.
>   Diff against P4 samples contains only the expected footer/contact and payment/notes changes.

---

### Chunk P6 — i18n keys and copy parity ✅
- [x] Add to `Dictionary` + `en` + `fr`: `pdf.from`, `pdf.dueDate`, `pdf.subtotal`,
      `pdf.column.unitPrice`, `pdf.payment`, `pdf.notes` (all added as first use;
      `pdf.issueDate` intentionally omitted — `pdf.date.invoice` remains `DATE`)
- [x] Keep existing keys and their exact rendering (`INVOICE #`, `DATE`, `VALID UNTIL`,
      `PAID ON`, `Tax`, `TOTAL`, `Page {current} of {total}`)
- [x] FR copy review: `ÉMETTEUR`, `DATE`, `DATE D'ÉCHÉANCE`, `SOUS-TOTAL`,
      `PRIX UNITAIRE`, `MODE DE PAIEMENT`, `NOTES`
- [x] Add `tests/i18n.test.ts` assertions for the new FR labels

**Verify:** parity test green; EN/FR samples contain the new labels and no English leakage;
`npm run format:check` green.

> Implementation notes:
> - All P6 keys are present in `Dictionary`/EN/FR. They were introduced as their first use
>   landed: `pdf.from`/`pdf.dueDate` in P2, `pdf.column.unitPrice` in P3, `pdf.subtotal` in P4,
>   and `pdf.payment`/`pdf.notes` in P5. `pdf.issueDate` was intentionally not added: the
>   existing `pdf.date.invoice` (`DATE` / `DATE`) remains the issue-date label, matching the
>   layout's date table and the earlier decision to avoid `DATE D'ÉMISSION`.
> - `tests/i18n.test.ts` now locks the reviewed French labels (`ÉMETTEUR`, `DATE`,
>   `DATE D'ÉCHÉANCE`, `SOUS-TOTAL`, `PRIX UNITAIRE`, `MODE DE PAIEMENT`, `NOTES`) and the
>   fixed contract labels (`INVOICE #`/`QUOTE #`/`RECEIPT #`, `DATE`, `VALID UNTIL`, `PAID ON`,
>   `Tax`, `TOTAL`, page placeholders).
> - The French PDF test now includes a due date, payment type and notes, asserts every new French
>   label and checks that the English counterparts (`FROM`, `BILL TO`, `INVOICE #`, `DUE DATE`,
>   `SUBTOTAL`, `PAYMENT METHOD`, `QTY`, `UNIT PRICE`, `AMOUNT`, `Page 1 of`) do not leak.
> - Verification: 180/180 tests, lint/format/build green; 30 samples regenerated (22 one-page,
>   8 three-page); 382 sample label checks pass across EN/FR, including due-date/quote/receipt
>   labels, payment/notes labels, and no English label leakage in French samples.

---

### Chunk P7 — Test suite, docs, config ✅
- [x] `tests/api.test.ts`: update the footer assertion (no `[Acme`), add subtotal, unit price,
      line amount, due date, payment, notes, and contact-line assertions
- [x] Keep every pre-existing assertion: validation, 15-item cap, totals, rounding, pagination,
      page numbers, document types, FR, no `undefined`, no client totals, invoice numbers
- [x] Add a renderer smoke test for 1-page, multi-page, FR, all four types
- [x] README: PDF architecture (`pdfLayout` tokens → `invoiceModel` → `pdfRenderer`), design rules,
      how to run `npm run samples:pdf`, how to add a PDF string/locale key
- [x] Run `npm run lint && npm run format:check && npm run build && npm test`

**Verify:** all four commands green from a clean checkout; sample matrix generated; every
payload field appears in at least one sample.

> Implementation notes:
> - Added `tests/pdfRenderer.test.ts`: direct `buildInvoiceModel` → `renderInvoicePdf` smoke tests
>   for all four document types (one page), 15 long rows (multi-page), and a French invoice. This
>   isolates the renderer from HTTP, validation and numbering.
> - P3–P6 already added the requested API assertions: unit price/line amount (items table),
>   subtotal/tax/total (totals ledger), due date, payment, notes, the contact-line join, and
>   `not.toContain('[Acme')`.
> - `scripts/pdf-samples.ts` now validates payload-field coverage before rendering and records
>   `coverage` (fields, document types, languages, currencies) in `manifest.json`. The zero-tax
>   receipt variant uses EUR, so the matrix covers USD, MAD, JPY and EUR without changing the
>   30-sample count.
> - README documents the `pdfLayout` tokens → `invoiceModel` → `pdfRenderer` pipeline, design
>   rules, the sample command/matrix, and the locale-key workflow.
> - Verification: `npm run lint`, `npm run format:check`, `npm run build`, `npm test` green;
>   186/186 tests; 30 samples regenerated (22 one-page, 8 three-page); coverage check passes with
>   all 21 form fields and currencies EUR/JPY/MAD/USD.

---

### Chunk P8 — Visual QA and sign-off ✅
- [x] Generate the full matrix: 4 types × EN/FR × 1/3/15 items × optional-field variants
- [x] Open the PDFs in a real viewer and check:
      top rule, header alignment, no grey box, one accent, hairline crispness, money alignment,
      description wrapping, unbroken totals, payment/notes, footer, `Page X of Y`
- [x] Check 15-item invoices for orphaned headers, split rows, or a ledger at the top of a blank page
- [x] Check `MAD`, `JPY`, `EUR` amounts and FR accented text
- [x] Check keyboard/reading order is irrelevant (print), but text extraction order is sane:
      title → meta → bill-to → table → totals → notes → footer
- [x] Confirm §2 principles: one accent, no boxes/shadows, every field represented, no overflow
- [x] User sign-off on the sample PDFs

**Verify:** checklist above; `npm test` green; sign-off recorded.

> Notes:
> - Regenerated the full matrix on 2026-10-25: 24 matrix + 6 optional-field variants
>   (30 PDFs; 22 one-page, 8 three-page), with all 21 payload fields covered.
> - Structural QA passed 10,382 assertions across all 30 samples: one 3 pt accent fill per
>   page, palette-only colours, 1 pt rules, margins/no overflow, right-aligned money,
>   footer-only footer band, correct `Page X of Y`, repeated table headers, sequential rows,
>   ledger after the last row, payment/notes columns, MAD/JPY/EUR symbols and FR labels.
> - `npm test` green: 12 files, 186/186 tests.
> - User visual sign-off recorded 2026-10-25 after reviewing representative samples from
>   `/tmp/pdf-samples`, including the 15-item, payment/notes, long-names and
>   MAD/JPY/EUR/FR variants.

---

### Chunk P9 — Optional: embed the app’s real fonts (gated)
**Do not start without explicit approval.** The current text-extraction helper cannot read
embedded subsets (verified); this chunk includes the test-infra migration.

- [ ] Add IBM Plex Sans Regular/Medium/SemiBold + Spectral SemiBold TTFs under
      `src/assets/fonts/` with their OFL licences (pin the source in the README)
- [ ] `registerPdfFonts(doc)` registers them with names `Body`, `BodyMedium`, `BodySemiBold`,
      `Display`; `FONTS` points at them; fallback to Helvetica/Times if a file is missing
- [ ] Dockerfile: copy `src/assets/fonts` into the runtime image (the build stage already copies `src`)
- [ ] Replace `tests/helpers/pdf.ts` with a Unicode-aware extractor
      (`pdfjs-dist` devDependency preferred) and update every `extractPdfText` call site
      (make it async if required); keep `isPdf` / `countPdfPages` behaviour
- [ ] Use `features: ['tnum', 'lnum']` for money if the font supports it
- [ ] Budget check: generated PDF stays under ~400 KB; generation time stays under ~100 ms locally

**Verify:** all text tests pass with embedded fonts; FR accents render and extract; missing-font
fallback test passes; Docker image contains the fonts; sample review confirms exact parity with the
preview’s Spectral/IBM Plex look.

> Notes:

---

## 5. Out of scope

- HTML-to-PDF engines (Puppeteer/Playwright) or a new rendering dependency in the core chunks.
- Persistence, download-by-id, server-side preview endpoints.
- Per-document-type layouts beyond title/date labels (no separate quote/receipt designs).
- Logo upload, QR codes, bank details, signatures, paid stamps, watermarks.
- Dark-mode PDFs (paper stays paper).
- Self-hosting webfonts for the browser UI (frontend follow-up; chunk P9 only covers PDF fonts).
- Aligning the live preview’s column labels with the new PDF (separate frontend tweak).
- Changing validation, API shape, rate limits, CSP or response headers.

---

## 6. Risks and notes

- **Test text extraction is the main coupling.** Standard fonts work today; any embedded font
  breaks `tests/helpers/pdf.ts` (confirmed). Keep P9 separate and migrate the helper in the same
  chunk, never before.
- **Text order matters to assertions.** Keep labels and values on the same logical line and in
  reading order. Test each chunk, not just at the end.
- **Pagination is the second risk.** Reserve the totals block and footer before drawing; measure
  wrapped descriptions; test 15 long rows, not 3 short ones.
- **WinAnsi limits.** Standard fonts cannot render every glyph. `formatMoney` already picks safe
  symbols; keep FR accents in the WinAnsi range and do not add new currency glyphs casually.
- **No visual renderer in this environment.** The `read` tool cannot display PDFs for this model
  and there is no `pdftoppm`/Chromium. QA is structural (text, page count) plus a human viewer
  on the generated samples. Do not claim “looks right” without sign-off.
- **Token drift.** `COLORS`/`TYPE` mirror `src/styles/app.css`; add a comment in both files that
  they are the print counterpart of the UI tokens and must be updated together.
- **Preserve hooks.** Before each test run, grep `tests/api.test.ts` for the strings you touch.
  Intentional copy changes get test updates in the same chunk, never a red suite.
- **Do not trust client totals.** The controller must keep deleting `subtotal`/`total` before the
  model is built, and the model must always recompute.
