import { describe, expect, it } from 'vitest';
import type { invoiceData, invoiceItem } from '../src/interfaces';
import { buildInvoiceModel } from '../src/services/invoiceModel';

const base = (overrides: Partial<invoiceData> = {}): invoiceData => ({
  documentType: 'SERVICE INVOICE',
  company: { name: 'Acme', address: '1 Main St', city: '75001 Paris' },
  client: { name: 'Bob' },
  number: 'INV-2026-0001',
  issueDate: '2026-01-01',
  items: [{ description: 'Widget', quantity: 2, price: 10 }],
  taxRate: 10,
  currency: 'USD',
  language: 'en',
  ...overrides,
});

describe('buildInvoiceModel', () => {
  it('builds indexed lines and server-side totals', () => {
    const model = buildInvoiceModel(base());

    expect(model.lines).toEqual([
      { index: 1, description: 'Widget', quantity: 2, price: 10, amount: 20 },
    ]);
    expect(model.subtotal).toBe(20);
    expect(model.taxValue).toBe(2);
    expect(model.grandTotal).toBe(22);
    expect(model.number).toBe('INV-2026-0001');
    expect(model.currency).toBe('USD');
    expect(model.lang).toBe('en');
    expect(model.style.kind).toBe('invoice');
  });

  it('rounds at the money boundary, not on every line', () => {
    const model = buildInvoiceModel(
      base({
        items: [{ description: 'Third of a cent', quantity: 3, price: 0.335 }],
        taxRate: 0,
      }),
    );

    expect(model.lines[0].amount).toBeCloseTo(1.005, 10);
    expect(model.subtotal).toBe(1.01);
    expect(model.taxValue).toBe(0);
    expect(model.grandTotal).toBe(1.01);
  });

  it.each([
    {
      name: 'tax rounds up from a half-cent',
      items: [{ description: 'A', quantity: 1, price: 2999.97 }],
      taxRate: 5,
      expected: { subtotal: 2999.97, taxValue: 150, grandTotal: 3149.97 },
    },
    {
      name: 'multi-line subtotal is rounded before tax',
      items: [{ description: 'A', quantity: 3, price: 19.99 }],
      taxRate: 7.25,
      expected: { subtotal: 59.97, taxValue: 4.35, grandTotal: 64.32 },
    },
    {
      name: 'subtotal and tax add up to the displayed total',
      items: [{ description: 'A', quantity: 1, price: 1234.5 }],
      taxRate: 10,
      expected: { subtotal: 1234.5, taxValue: 123.45, grandTotal: 1357.95 },
    },
  ])('$name', ({ items, taxRate, expected }) => {
    const model = buildInvoiceModel(base({ items, taxRate }));
    expect(model.subtotal).toBe(expected.subtotal);
    expect(model.taxValue).toBe(expected.taxValue);
    expect(model.grandTotal).toBe(expected.grandTotal);
  });

  it('recalculates totals instead of trusting client-supplied values', () => {
    const model = buildInvoiceModel(base({ subtotal: 1, total: 1 }));

    expect(model.subtotal).toBe(20);
    expect(model.taxValue).toBe(2);
    expect(model.grandTotal).toBe(22);
  });

  it('coerces numeric strings like the old renderer did', () => {
    const items = [
      { description: 'Widget', quantity: '2', price: '10' },
    ] as unknown as invoiceItem[];
    const model = buildInvoiceModel(base({ items }));

    expect(model.lines[0]).toMatchObject({ quantity: 2, price: 10, amount: 20 });
    expect(model.grandTotal).toBe(22);
  });

  it('keeps an empty item list at zero', () => {
    const model = buildInvoiceModel(base({ items: [] }));

    expect(model.lines).toEqual([]);
    expect(model.subtotal).toBe(0);
    expect(model.taxValue).toBe(0);
    expect(model.grandTotal).toBe(0);
  });

  it('uses issue and due dates for invoices', () => {
    const model = buildInvoiceModel(base({ dueDate: '2026-01-31' }));

    expect(model.primaryDate).toEqual({ value: '2026-01-01', role: 'issue' });
    expect(model.secondaryDate).toEqual({ value: '2026-01-31', role: 'due' });
    expect(model.dueDate).toBe('2026-01-31');
  });

  it('has no secondary date for an invoice without a due date', () => {
    const model = buildInvoiceModel(base());

    expect(model.primaryDate).toEqual({ value: '2026-01-01', role: 'issue' });
    expect(model.secondaryDate).toBeNull();
    expect(model.dueDate).toBeNull();
  });

  it('uses the due date as primary and the issue date as secondary for a quote', () => {
    const model = buildInvoiceModel(base({ documentType: 'QUOTE', dueDate: '2026-02-15' }));

    expect(model.style.kind).toBe('quote');
    expect(model.primaryDate).toEqual({ value: '2026-02-15', role: 'due' });
    expect(model.secondaryDate).toEqual({ value: '2026-01-01', role: 'issue' });
  });

  it('falls back to the issue date for a quote without a due date', () => {
    const model = buildInvoiceModel(base({ documentType: 'QUOTE' }));

    expect(model.primaryDate).toEqual({ value: '2026-01-01', role: 'issue' });
    expect(model.secondaryDate).toBeNull();
  });

  it('shows only the issue date for a receipt, even when a due date is sent', () => {
    const model = buildInvoiceModel(base({ documentType: 'RECEIPT', dueDate: '2026-02-15' }));

    expect(model.style.kind).toBe('receipt');
    expect(model.primaryDate).toEqual({ value: '2026-01-01', role: 'issue' });
    expect(model.secondaryDate).toBeNull();
  });

  it('treats product invoices like service invoices', () => {
    const model = buildInvoiceModel(
      base({ documentType: 'PRODUCT INVOICE', dueDate: '2026-01-31' }),
    );

    expect(model.style.kind).toBe('invoice');
    expect(model.primaryDate).toEqual({ value: '2026-01-01', role: 'issue' });
    expect(model.secondaryDate).toEqual({ value: '2026-01-31', role: 'due' });
  });

  it('falls back to invoice dates for an unknown document type', () => {
    const model = buildInvoiceModel(base({ documentType: 'CUSTOM', dueDate: '2026-01-31' }));

    expect(model.style.kind).toBe('invoice');
    expect(model.primaryDate).toEqual({ value: '2026-01-01', role: 'issue' });
    expect(model.secondaryDate).toEqual({ value: '2026-01-31', role: 'due' });
  });

  it('normalises optional fields and language', () => {
    const model = buildInvoiceModel(
      base({ paymentType: undefined, notes: undefined, currency: undefined, language: 'de' }),
    );

    expect(model.paymentType).toBe('');
    expect(model.notes).toBe('');
    expect(model.currency).toBe('');
    expect(model.lang).toBe('en');
  });

  it('keeps French labels and payment/notes text', () => {
    const model = buildInvoiceModel(
      base({
        language: 'fr',
        paymentType: 'Virement bancaire',
        notes: 'Merci de votre confiance.',
      }),
    );

    expect(model.lang).toBe('fr');
    expect(model.paymentType).toBe('Virement bancaire');
    expect(model.notes).toBe('Merci de votre confiance.');
  });
});
