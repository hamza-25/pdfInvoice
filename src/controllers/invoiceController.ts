import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { invoiceData, invoiceItem } from '../interfaces';
import { validationResult } from 'express-validator';
import { LAYOUT, documentTypeStyle } from '../services/pdfLayout';
import { formatMoney, formatDate } from '../services/currency';
import { t, resolveLanguage } from '../services/i18n';
import { generateInvoiceNumber } from '../services/invoiceNumber';
import { catchAsync } from '../utils/catchAsync';
import { round2 } from '../utils/round2';

export const invoiceGenerate = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.log.warn({ errors: errors.array() }, 'invoice validation failed');
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const data: invoiceData = req.body;
  // Never trust client-computed totals — they are always recalculated below.
  delete data.subtotal;
  delete data.total;
  data.number = generateInvoiceNumber();

  const currency = data.currency ?? '';
  const lang = resolveLanguage(data.language);
  const taxRate = data.taxRate ?? 0;
  const startedAt = process.hrtime.bigint();

  const doc = new PDFDocument({ size: 'A4', margin: LAYOUT.margin, bufferPages: true });
  const contentRight = doc.page.width - LAYOUT.margin;
  const bottomLimit = doc.page.height - LAYOUT.bottomMargin;

  res.setHeader('Content-Type', 'application/pdf');
  const companyName = (data.company && data.company.name) ? String(data.company.name).trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
  const companyCity = (data.company && data.company.city) ? String(data.company.city).trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
  const filenameParts = [];
  if (companyName) filenameParts.push(companyName);
  if (companyCity) filenameParts.push(companyCity);
  filenameParts.push('invoice');
  const filename = filenameParts.filter(Boolean).join('-') + '.pdf';
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // Expose the generated document number to same-origin clients (chunk R6's
  // success panel shows it). The PDF itself already prints the same number.
  res.setHeader('X-Invoice-Number', data.number);
  doc.pipe(res);

  // ---- Header ----
  const style = documentTypeStyle(data.documentType);
  const primaryDate =
    style.dateField === 'dueDate' ? data.dueDate || data.issueDate : data.issueDate;

  doc.fontSize(20).fillColor(style.accent).text(t(style.titleKey, lang), 450, LAYOUT.margin);

  // Company info (top-left)
  doc
    .fillColor('black')
    .fontSize(10)
    .text(data.company.name, LAYOUT.margin, LAYOUT.margin)
    .text(data.company.address || '', LAYOUT.margin, LAYOUT.margin + 15)
    .text(data.company.city || '', LAYOUT.margin, LAYOUT.margin + 30);

  // Document info (top-right)
  doc
    .text(`${t(style.idKey, lang)}:`, 400, 100)
    .text(data.number, 470, 100)
    .text(`${t(style.dateKey, lang)}:`, 400, 115)
    .text(formatDate(primaryDate, lang), 470, 115);

  // Accent rule under the header
  doc
    .moveTo(LAYOUT.margin, 90)
    .lineTo(contentRight, 90)
    .lineWidth(2)
    .strokeColor(style.accent)
    .stroke()
    .lineWidth(1)
    .strokeColor('black');

  // ---- Bill To box ----
  doc
    .rect(LAYOUT.margin, 140, 200, 20)
    .fill('#e0e0e0')
    .stroke()
    .fillColor('black')
    .text(t('pdf.billTo', lang), 55, 145);

  doc
    .fillColor('black')
    .text(data.client.name, 55, 165)
    .text(data.client.address || '', 55, 180)
    .text(data.client.city || '', 55, 195)
    .text(data.client.phone || '', 55, 210)
    .text(data.client.email || '', 55, 225);

  /**
   * Draw the table header (rule, labels, rule) at `y` and return the y at
   * which the first row should start. Re-drawn on every new page.
   */
  const drawTableHeader = (y: number): number => {
    doc.moveTo(LAYOUT.margin, y).lineTo(contentRight, y).stroke();

    const labelY = y + 5;
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(t('pdf.column.description', lang), LAYOUT.columns.description.x, labelY)
      .text(t('pdf.column.quantity', lang), LAYOUT.columns.quantity.x, labelY)
      .text(t('pdf.column.amount', lang), LAYOUT.columns.amount.x, labelY);

    const lineY = y + 20;
    doc.moveTo(LAYOUT.margin, lineY).lineTo(contentRight, lineY).stroke();
    return lineY + LAYOUT.row.top;
  };

  /**
   * Compact header for pages after the first: company name on the left,
   * document type + number on the right.
   */
  const drawContinuationHeader = (): void => {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('black')
      .text(data.company.name, LAYOUT.margin, LAYOUT.margin, { width: 250, ellipsis: true })
      .text(`${t(style.titleKey, lang)} ${data.number}`, contentRight - 200, LAYOUT.margin, {
        width: 200,
        align: 'right',
      });
  };

  /** Start a new page with the continuation header + table header. */
  const newPageWithHeader = (): number => {
    doc.addPage();
    drawContinuationHeader();
    return drawTableHeader(LAYOUT.margin + LAYOUT.continuation.height);
  };

  /** Add a page when `needed` points would overflow, and return the new y. */
  const ensureSpace = (y: number, needed: number): number => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      drawContinuationHeader();
      return LAYOUT.margin + LAYOUT.continuation.height;
    }
    return y;
  };

  // ---- Items table ----
  let cursorY = drawTableHeader(270);
  let total = 0;

  data.items.forEach((element: invoiceItem) => {
    const description = element.description ?? '';
    const descriptionHeight = doc.heightOfString(description, {
      width: LAYOUT.columns.description.width,
    });
    const rowHeight = Math.max(LAYOUT.row.minHeight, descriptionHeight + LAYOUT.row.paddingY);

    if (cursorY + rowHeight > bottomLimit) {
      cursorY = newPageWithHeader();
    }

    doc
      .font('Helvetica')
      .fontSize(10)
      .text(description, LAYOUT.columns.description.x, cursorY, {
        width: LAYOUT.columns.description.width,
      })
      .text(String(element.quantity ?? ''), LAYOUT.columns.quantity.x, cursorY)
      .text(formatMoney(Number(element.price) || 0, currency), LAYOUT.columns.amount.x, cursorY);

    cursorY += rowHeight;
    total += (element.price || 0) * (element.quantity || 0);
  });

  // ---- Totals ----
  // Money is rounded to cents so the PDF never shows float artifacts (e.g. 3149.9685).
  const subtotal = round2(total);
  const taxValue = round2((subtotal * taxRate) / 100);
  const grandTotal = round2(subtotal + taxValue);
  cursorY = ensureSpace(cursorY, LAYOUT.totals.height);

  doc
    .text(`${t('pdf.tax', lang)} (${taxRate}%)`, LAYOUT.columns.description.x, cursorY)
    .text(formatMoney(taxValue, currency), LAYOUT.columns.amount.x, cursorY);

  cursorY += LAYOUT.totals.lineGap;
  doc.moveTo(LAYOUT.margin, cursorY).lineTo(contentRight, cursorY).stroke();

  cursorY += LAYOUT.totals.lineGap;
  doc
    .font('Helvetica-Bold')
    .text(t('pdf.total', lang), 400, cursorY)
    .text(formatMoney(grandTotal, currency), LAYOUT.columns.amount.x, cursorY);

  // ---- Footer ----
  cursorY += LAYOUT.totals.footerGap;
  cursorY = ensureSpace(cursorY, LAYOUT.totals.footerHeight);
  doc
    .font('Helvetica')
    .fontSize(10)
    .text(t('pdf.thanks', lang), LAYOUT.margin, cursorY)
    .fontSize(8)
    .text(t('pdf.contactNote', lang), LAYOUT.margin, cursorY + 40)
    .text(
      `[${data.company.name}, ${data.company.phone ?? ''}, ${data.company.email ?? ''}]`,
      LAYOUT.margin,
      cursorY + 50,
    );

  // ---- Page numbers ----
  // With bufferPages the content is already written but not yet flushed, so
  // every buffered page can be visited to stamp "Page X of Y".
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing this close to the page edge needs the bottom margin disabled,
    // otherwise PDFKit would spill the footer onto yet another page.
    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('black')
      .text(
        t('pdf.pageOf', lang, { current: i - range.start + 1, total: range.count }),
        LAYOUT.margin,
        doc.page.height - LAYOUT.footer.fromBottom,
        { width: contentRight - LAYOUT.margin, align: 'center' },
      );
    doc.page.margins.bottom = savedBottomMargin;
  }

  doc.end();

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  req.log.info(
    { invoiceNumber: data.number, durationMs: Math.round(durationMs * 100) / 100 },
    'invoice generated',
  );
});
