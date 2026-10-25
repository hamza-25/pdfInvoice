import type { clientData, companyData, invoiceData } from '../interfaces';
import { round2 } from '../utils/round2';
import { resolveLanguage, type Language } from './i18n';
import { documentTypeStyle, type DocumentTypeStyle } from './pdfLayout';

/** A single printable line, with its amount computed server-side. */
export interface InvoiceLine {
  /** 1-based position in the table. */
  index: number;
  description: string;
  quantity: number;
  price: number;
  /** `quantity * price`, unrounded; totals round once at the end. */
  amount: number;
}

/** Semantic role of a displayed date; the renderer maps it to a label. */
export type InvoiceDateRole = 'issue' | 'due';

export interface InvoiceDateLine {
  value: string;
  role: InvoiceDateRole;
}

/**
 * Everything the PDF renderer needs, with all customer input normalised and
 * every monetary value recomputed. No client-supplied totals survive.
 */
export interface InvoiceModel {
  lang: Language;
  currency: string;
  style: DocumentTypeStyle;
  number: string;
  company: companyData;
  client: clientData;
  issueDate: string;
  dueDate: string | null;
  primaryDate: InvoiceDateLine | null;
  secondaryDate: InvoiceDateLine | null;
  lines: InvoiceLine[];
  subtotal: number;
  taxValue: number;
  taxRate: number;
  grandTotal: number;
  paymentType: string;
  notes: string;
}

const toDateLine = (value: string | undefined, role: InvoiceDateRole): InvoiceDateLine | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? { value: trimmed, role } : null;
};

/**
 * Pick the date(s) shown in the header.
 *
 * - invoice: issue date, with the due date as a secondary line when present
 * - quote: due date as "valid until", falling back to the issue date
 * - receipt: issue date ("paid on") only
 *
 * The returned roles let the next layout pass choose labels without
 * re-deriving document-type rules.
 */
const selectDates = (
  data: invoiceData,
  style: DocumentTypeStyle,
): { primaryDate: InvoiceDateLine | null; secondaryDate: InvoiceDateLine | null } => {
  const issue = toDateLine(data.issueDate, 'issue');
  const due = toDateLine(data.dueDate, 'due');

  if (style.kind === 'quote') {
    return due
      ? { primaryDate: due, secondaryDate: issue }
      : { primaryDate: issue, secondaryDate: null };
  }

  if (style.kind === 'receipt') {
    return { primaryDate: issue, secondaryDate: null };
  }

  return { primaryDate: issue, secondaryDate: due };
};

/**
 * Build the complete, immutable render model from validated request data.
 *
 * All arithmetic happens here, in one place: line amounts, subtotal, tax and
 * grand total. The renderer only formats these values.
 */
export const buildInvoiceModel = (data: invoiceData): InvoiceModel => {
  const style = documentTypeStyle(data.documentType);
  const lang = resolveLanguage(data.language);
  const currency = data.currency ?? '';
  const taxRate = data.taxRate ?? 0;

  const lines: InvoiceLine[] = (data.items ?? []).map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return {
      index: index + 1,
      description: item.description ?? '',
      quantity,
      price,
      amount: quantity * price,
    };
  });

  // Round once, at the money boundary, so the PDF never shows float artifacts
  // (e.g. 3149.9685) and the subtotal + tax always add up to the total.
  const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const taxValue = round2((subtotal * taxRate) / 100);
  const grandTotal = round2(subtotal + taxValue);
  const { primaryDate, secondaryDate } = selectDates(data, style);

  return {
    lang,
    currency,
    style,
    number: data.number ?? '',
    company: data.company,
    client: data.client,
    issueDate: data.issueDate ?? '',
    dueDate: data.dueDate?.trim() || null,
    primaryDate,
    secondaryDate,
    lines,
    subtotal,
    taxValue,
    taxRate,
    grandTotal,
    paymentType: data.paymentType ?? '',
    notes: data.notes ?? '',
  };
};
