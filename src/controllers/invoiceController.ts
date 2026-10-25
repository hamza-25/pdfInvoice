import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { invoiceData } from '../interfaces';
import { validationResult } from 'express-validator';
import { LAYOUT } from '../services/pdfLayout';
import { buildInvoiceModel } from '../services/invoiceModel';
import { renderInvoicePdf } from '../services/pdfRenderer';
import { generateInvoiceNumber } from '../services/invoiceNumber';
import { catchAsync } from '../utils/catchAsync';

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

  const model = buildInvoiceModel(data);
  const startedAt = process.hrtime.bigint();

  const doc = new PDFDocument({ size: 'A4', margin: LAYOUT.margin, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  const clientName =
    data.client && data.client.name
      ? String(data.client.name)
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : '';
  const clientCity =
    data.client && data.client.city
      ? String(data.client.city)
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : '';
  const filenameParts = [];
  if (clientName) filenameParts.push(clientName);
  if (clientCity) filenameParts.push(clientCity);
  filenameParts.push('invoice');
  const filename = filenameParts.filter(Boolean).join('-') + '.pdf';
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // Expose the generated document number to same-origin clients (chunk R6's
  // success panel shows it). The PDF itself already prints the same number.
  res.setHeader('X-Invoice-Number', model.number);
  doc.pipe(res);

  renderInvoicePdf(doc, model);
  doc.end();

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  req.log.info(
    { invoiceNumber: model.number, durationMs: Math.round(durationMs * 100) / 100 },
    'invoice generated',
  );
});
