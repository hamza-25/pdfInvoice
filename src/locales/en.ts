/**
 * English translation dictionary — the source of truth for translation keys.
 *
 * Keys are flat and dotted: lookups stay fully typed, EN/FR parity is easy to
 * test, and the whole dictionary is served to the browser at /i18n.js for the
 * client-side language switch (chunk 5.3). Chunk 5.4 adds API error keys.
 */
export interface Dictionary {
  // ---- PDF strings (resolved server-side) ----
  'pdf.invoice.title': string;
  'pdf.invoice.idLabel': string;
  'pdf.quote.title': string;
  'pdf.quote.idLabel': string;
  'pdf.receipt.title': string;
  'pdf.receipt.idLabel': string;
  'pdf.date.invoice': string;
  'pdf.date.quote': string;
  'pdf.date.receipt': string;
  'pdf.billTo': string;
  'pdf.column.description': string;
  'pdf.column.quantity': string;
  'pdf.column.amount': string;
  'pdf.tax': string; // rendered as "<tax> (<rate>%)"
  'pdf.total': string;
  'pdf.thanks': string;
  'pdf.contactNote': string;
  'pdf.pageOf': string; // {current} / {total} placeholders

  // ---- Website UI (resolved client-side via /i18n.js) ----
  'ui.title': string;
  'ui.subtitle': string;
  'ui.pageTitle': string;
  'ui.langLabel': string;
  'ui.langEnAria': string;
  'ui.langFrAria': string;

  'ui.docTypeHeading': string;
  'ui.docTypeLabel': string;
  'ui.docTypeService': string;
  'ui.docTypeProduct': string;
  'ui.docTypeQuote': string;
  'ui.docTypeReceipt': string;

  'ui.from': string;
  'ui.billTo': string;
  'ui.companyNameLabel': string;
  'ui.companyAddressLabel': string;
  'ui.companyPhoneLabel': string;
  'ui.companyCityLabel': string;
  'ui.companyEmailLabel': string;
  'ui.clientNameLabel': string;
  'ui.clientAddressLabel': string;
  'ui.clientPhoneLabel': string;
  'ui.clientCityLabel': string;
  'ui.clientEmailLabel': string;
  'ui.companyNamePh': string;
  'ui.companyAddressPh': string;
  'ui.companyPhonePh': string;
  'ui.companyCityPh': string;
  'ui.companyEmailPh': string;
  'ui.clientNamePh': string;
  'ui.clientAddressPh': string;
  'ui.clientPhonePh': string;
  'ui.clientCityPh': string;
  'ui.clientEmailPh': string;

  'ui.dateLabel': string;
  'ui.dueDateLabel': string;
  'ui.currencyLabel': string;

  'ui.itemsHeading': string;
  'ui.tableDescription': string;
  'ui.tableQty': string;
  'ui.tablePrice': string;
  'ui.actions': string;
  'ui.addItem': string;
  'ui.itemsLimitHint': string;
  'ui.itemDescriptionPh': string;
  'ui.itemDescriptionAria': string;
  'ui.itemQuantityAria': string;
  'ui.itemPriceAria': string;
  'ui.removeItemAria': string;

  'ui.subtotal': string;
  'ui.taxRate': string;
  'ui.total': string;

  'ui.paymentHeading': string;
  'ui.paymentLabel': string;
  'ui.paymentPh': string;
  'ui.notesHeading': string;
  'ui.notesLabel': string;
  'ui.notesPh': string;

  'ui.submit': string;
  'ui.processing': string;
  'ui.toastPreview': string;
  'ui.toastDownloaded': string;
  'ui.errorGeneric': string;
  'ui.errorMore': string; // {count} placeholder
}

/** Every valid translation key. */
export type TranslationKey = keyof Dictionary;

export const en: Dictionary = {
  // PDF
  'pdf.invoice.title': 'INVOICE',
  'pdf.invoice.idLabel': 'INVOICE #',
  'pdf.quote.title': 'QUOTE',
  'pdf.quote.idLabel': 'QUOTE #',
  'pdf.receipt.title': 'RECEIPT',
  'pdf.receipt.idLabel': 'RECEIPT #',
  'pdf.date.invoice': 'DATE',
  'pdf.date.quote': 'VALID UNTIL',
  'pdf.date.receipt': 'PAID ON',
  'pdf.billTo': 'BILL TO',
  'pdf.column.description': 'DESCRIPTION',
  'pdf.column.quantity': 'Quantity',
  'pdf.column.amount': 'AMOUNT',
  'pdf.tax': 'Tax',
  'pdf.total': 'TOTAL',
  'pdf.thanks': 'Thank you for your business!',
  'pdf.contactNote': 'If you have any questions about this invoice, please contact Us',
  'pdf.pageOf': 'Page {current} of {total}',

  // UI
  'ui.title': 'Professional Document Builder',
  'ui.subtitle': 'Fill the form to generate your document.',
  'ui.pageTitle': 'Invoice Generator Pro',
  'ui.langLabel': 'Language',
  'ui.langEnAria': 'Switch to English',
  'ui.langFrAria': 'Switch to French',
  'ui.docTypeHeading': 'Document Type',
  'ui.docTypeLabel': 'Document type',
  'ui.docTypeService': 'Service Invoice',
  'ui.docTypeProduct': 'Product Invoice',
  'ui.docTypeQuote': 'Quote',
  'ui.docTypeReceipt': 'Receipt',
  'ui.from': 'From',
  'ui.billTo': 'Bill To',
  'ui.companyNameLabel': 'Company name',
  'ui.companyAddressLabel': 'Company address',
  'ui.companyPhoneLabel': 'Company phone',
  'ui.companyCityLabel': 'Company city',
  'ui.companyEmailLabel': 'Company email',
  'ui.clientNameLabel': 'Client name',
  'ui.clientAddressLabel': 'Client address',
  'ui.clientPhoneLabel': 'Client phone',
  'ui.clientCityLabel': 'Client city',
  'ui.clientEmailLabel': 'Client email',
  'ui.companyNamePh': 'Your Company Name',
  'ui.companyAddressPh': 'Your Address...',
  'ui.companyPhonePh': 'Your Company phone',
  'ui.companyCityPh': 'Your company city',
  'ui.companyEmailPh': 'Your company email',
  'ui.clientNamePh': "Client's Company Name",
  'ui.clientAddressPh': "Client's Address...",
  'ui.clientPhonePh': 'Your client phone',
  'ui.clientCityPh': 'Your client city',
  'ui.clientEmailPh': 'Your client email',
  'ui.dateLabel': 'Date',
  'ui.dueDateLabel': 'Due Date',
  'ui.currencyLabel': 'Currency',
  'ui.itemsHeading': 'Items (max: 15)',
  'ui.tableDescription': 'Description',
  'ui.tableQty': 'Qty',
  'ui.tablePrice': 'Price',
  'ui.actions': 'Actions',
  'ui.addItem': 'Add Item',
  'ui.itemsLimitHint': 'Maximum of 15 items reached.',
  'ui.itemDescriptionPh': 'Item description',
  'ui.itemDescriptionAria': 'Item description',
  'ui.itemQuantityAria': 'Quantity',
  'ui.itemPriceAria': 'Price',
  'ui.removeItemAria': 'Remove item',
  'ui.subtotal': 'Subtotal',
  'ui.taxRate': 'Tax (%)',
  'ui.total': 'Total',
  'ui.paymentHeading': 'Payment Type',
  'ui.paymentLabel': 'Payment type',
  'ui.paymentPh': 'e.g., Bank Transfer, Credit Card, Net 30',
  'ui.notesHeading': 'Notes',
  'ui.notesLabel': 'Notes',
  'ui.notesPh': 'Thank you for your business!',
  'ui.submit': 'Submit for Processing',
  'ui.processing': 'Processing...',
  'ui.toastPreview': 'Invoice opened in a new tab',
  'ui.toastDownloaded': 'Invoice generated successfully',
  'ui.errorGeneric': 'Something went wrong, please try again.',
  'ui.errorMore': '…and {count} more',
};
