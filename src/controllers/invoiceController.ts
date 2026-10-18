import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { invoiceData, invoiceItem } from '../interfaces';
import { validationResult } from 'express-validator';
import { LAYOUT } from '../services/pdfLayout';
import { generateInvoiceNumber } from '../services/invoiceNumber';
import { catchAsync } from '../utils/catchAsync';

export const invoiceGenerate = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const data: invoiceData = req.body;
  // Never trust client-computed totals — they are always recalculated below.
  delete data.subtotal;
  delete data.total;
  data.number = generateInvoiceNumber();

  const currency = data.currency ?? '';
  const taxRate = data.taxRate ?? 0;

  const doc = new PDFDocument({ size: 'A4', margin: LAYOUT.margin });
  const contentRight = doc.page.width - LAYOUT.margin;
  const bottomLimit = doc.page.height - LAYOUT.bottomMargin;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=static-invoice.pdf');
  doc.pipe(res);

  // ---- Header ----
  doc.fontSize(20).text('INVOICE', 450, LAYOUT.margin);

  // Company info (top-left)
  doc
    .fontSize(10)
    .text(data.company.name, LAYOUT.margin, LAYOUT.margin)
    .text(data.company.address || '', LAYOUT.margin, LAYOUT.margin + 15)
    .text(data.company.city || '', LAYOUT.margin, LAYOUT.margin + 30);

  // Invoice info (top-right)
  doc
    .text('INVOICE #:', 400, 100)
    .text(data.number, 470, 100)
    .text('DATE:', 400, 115)
    .text(data.issueDate, 470, 115);

  // ---- Bill To box ----
  doc
    .rect(LAYOUT.margin, 140, 200, 20)
    .fill('#e0e0e0')
    .stroke()
    .fillColor('black')
    .text('BILL TO', 55, 145);

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
      .text('DESCRIPTION', LAYOUT.columns.description.x, labelY)
      .text('Quantity', LAYOUT.columns.quantity.x, labelY)
      .text('AMOUNT', LAYOUT.columns.amount.x, labelY);

    const lineY = y + 20;
    doc.moveTo(LAYOUT.margin, lineY).lineTo(contentRight, lineY).stroke();
    return lineY + LAYOUT.row.top;
  };

  /** Add a page when `needed` points would overflow, and return the new y. */
  const ensureSpace = (y: number, needed: number): number => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      return LAYOUT.margin;
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
      doc.addPage();
      cursorY = drawTableHeader(LAYOUT.margin);
    }

    doc
      .font('Helvetica')
      .fontSize(10)
      .text(description, LAYOUT.columns.description.x, cursorY, {
        width: LAYOUT.columns.description.width,
      })
      .text(String(element.quantity ?? ''), LAYOUT.columns.quantity.x, cursorY)
      .text(`${element.price ?? ''}${currency}`, LAYOUT.columns.amount.x, cursorY);

    cursorY += rowHeight;
    total += (element.price || 0) * (element.quantity || 0);
  });

  // ---- Totals ----
  const taxValue = (taxRate * total) / 100;
  cursorY = ensureSpace(cursorY, LAYOUT.totals.height);

  doc
    .text(`Tax (${taxRate}%)`, LAYOUT.columns.description.x, cursorY)
    .text(`${taxValue.toFixed(2)}${currency}`, LAYOUT.columns.amount.x, cursorY);

  cursorY += LAYOUT.totals.lineGap;
  doc.moveTo(LAYOUT.margin, cursorY).lineTo(contentRight, cursorY).stroke();

  cursorY += LAYOUT.totals.lineGap;
  doc
    .font('Helvetica-Bold')
    .text('TOTAL', 400, cursorY)
    .text(`${total + taxValue}${currency}`, LAYOUT.columns.amount.x, cursorY);

  // ---- Footer ----
  cursorY += LAYOUT.totals.footerGap;
  cursorY = ensureSpace(cursorY, LAYOUT.totals.footerHeight);
  doc
    .font('Helvetica')
    .fontSize(10)
    .text('Thank you for your business!', LAYOUT.margin, cursorY)
    .fontSize(8)
    .text(
      'If you have any questions about this invoice, please contact Us',
      LAYOUT.margin,
      cursorY + 40,
    )
    .text(
      `[${data.company.name}, ${data.company.phone ?? ''}, ${data.company.email ?? ''}]`,
      LAYOUT.margin,
      cursorY + 50,
    );

  doc.end();
});
