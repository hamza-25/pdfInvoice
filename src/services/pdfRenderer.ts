import { formatDate, formatMoney } from './currency';
import { t } from './i18n';
import type { InvoiceModel } from './invoiceModel';
import { LAYOUT } from './pdfLayout';

/**
 * Draw the invoice onto an existing PDFKit document.
 *
 * This is a 1:1 extraction of the pre-redesign drawing code: same coordinates,
 * fonts, colours and text order. The invoice model is the only input, so the
 * next layout chunks can change presentation without touching request handling
 * or money maths.
 */
export const renderInvoicePdf = (doc: PDFKit.PDFDocument, model: InvoiceModel): void => {
  const { lang, style } = model;
  const contentRight = doc.page.width - LAYOUT.margin;
  const bottomLimit = doc.page.height - LAYOUT.bottomMargin;

  // ---- Header ----
  doc.fontSize(20).fillColor(style.accent).text(t(style.titleKey, lang), 450, LAYOUT.margin);

  // Company info (top-left)
  doc
    .fillColor('black')
    .fontSize(10)
    .text(model.company.name, LAYOUT.margin, LAYOUT.margin)
    .text(model.company.address || '', LAYOUT.margin, LAYOUT.margin + 15)
    .text(model.company.city || '', LAYOUT.margin, LAYOUT.margin + 30);

  // Document info (top-right)
  doc
    .text(`${t(style.idKey, lang)}:`, 400, 100)
    .text(model.number, 470, 100)
    .text(`${t(style.dateKey, lang)}:`, 400, 115)
    .text(formatDate(model.primaryDate?.value ?? '', lang), 470, 115);

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
    .text(model.client.name, 55, 165)
    .text(model.client.address || '', 55, 180)
    .text(model.client.city || '', 55, 195)
    .text(model.client.phone || '', 55, 210)
    .text(model.client.email || '', 55, 225);

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
      .text(model.company.name, LAYOUT.margin, LAYOUT.margin, { width: 250, ellipsis: true })
      .text(`${t(style.titleKey, lang)} ${model.number}`, contentRight - 200, LAYOUT.margin, {
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

  model.lines.forEach((line) => {
    const description = line.description;
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
      .text(String(line.quantity), LAYOUT.columns.quantity.x, cursorY)
      .text(formatMoney(line.price, model.currency), LAYOUT.columns.amount.x, cursorY);

    cursorY += rowHeight;
  });

  // ---- Totals ----
  // Money is rounded to cents so the PDF never shows float artifacts (e.g. 3149.9685).
  cursorY = ensureSpace(cursorY, LAYOUT.totals.height);

  doc
    .text(`${t('pdf.tax', lang)} (${model.taxRate}%)`, LAYOUT.columns.description.x, cursorY)
    .text(formatMoney(model.taxValue, model.currency), LAYOUT.columns.amount.x, cursorY);

  cursorY += LAYOUT.totals.lineGap;
  doc.moveTo(LAYOUT.margin, cursorY).lineTo(contentRight, cursorY).stroke();

  cursorY += LAYOUT.totals.lineGap;
  doc
    .font('Helvetica-Bold')
    .text(t('pdf.total', lang), 400, cursorY)
    .text(formatMoney(model.grandTotal, model.currency), LAYOUT.columns.amount.x, cursorY);

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
      `[${model.company.name}, ${model.company.phone ?? ''}, ${model.company.email ?? ''}]`,
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
};
