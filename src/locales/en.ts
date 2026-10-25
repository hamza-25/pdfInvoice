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
  'pdf.dueDate': string;
  'pdf.from': string;
  'pdf.billTo': string;
  'pdf.column.description': string;
  'pdf.column.quantity': string;
  'pdf.column.unitPrice': string;
  'pdf.column.amount': string;
  'pdf.tax': string; // rendered as "<tax> (<rate>%)"
  'pdf.subtotal': string;
  'pdf.total': string;
  'pdf.thanks': string;
  'pdf.contactNote': string;
  'pdf.payment': string;
  'pdf.notes': string;
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
  'ui.itemsOf': string; // {count} placeholder
  'ui.itemN': string; // {n} placeholder
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

  // ---- Live preview (chunk R5) ----
  'ui.preview': string;
  'ui.previewOpen': string;
  'ui.previewOpenAria': string;
  'ui.previewCloseAria': string;

  // ---- Success flow (chunk R6) ----
  'ui.successTitle': string;
  'ui.successBody': string;
  'ui.openPreview': string;
  'ui.newDocument': string;
  'ui.collapse': string;
  'ui.expand': string;

  // ---- API validation errors (chunk 5.4) ----
  'error.documentTypeRequired': string;
  'error.documentTypeMax': string;
  'error.companyObject': string;
  'error.companyNameRequired': string;
  'error.companyNameMax': string;
  'error.companyAddressMax': string;
  'error.companyEmail': string;
  'error.companyPhoneMax': string;
  'error.companyCityMax': string;
  'error.clientObject': string;
  'error.clientNameRequired': string;
  'error.clientNameMax': string;
  'error.clientAddressMax': string;
  'error.clientEmail': string;
  'error.clientPhoneMax': string;
  'error.clientCityMax': string;
  'error.issueDateRequired': string;
  'error.dueDateMax': string;
  'error.itemsArray': string;
  'error.itemDescriptionRequired': string;
  'error.itemDescriptionMax': string;
  'error.itemPriceNumber': string;
  'error.itemQuantityNumber': string;
  'error.paymentTypeMax': string;
  'error.notesMax': string;
  'error.taxRateNumber': string;
  'error.currencyRequired': string;
  'error.currencyMax': string;
  'error.languageInvalid': string;
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
  'pdf.dueDate': 'DUE DATE',
  'pdf.from': 'FROM',
  'pdf.billTo': 'BILL TO',
  'pdf.column.description': 'DESCRIPTION',
  'pdf.column.quantity': 'QTY',
  'pdf.column.unitPrice': 'UNIT PRICE',
  'pdf.column.amount': 'AMOUNT',
  'pdf.tax': 'Tax',
  'pdf.subtotal': 'SUBTOTAL',
  'pdf.total': 'TOTAL',
  'pdf.thanks': 'Thank you for your business!',
  'pdf.contactNote': 'If you have any questions about this invoice, please contact Us',
  'pdf.payment': 'PAYMENT METHOD',
  'pdf.notes': 'NOTES',
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
  'ui.itemsHeading': 'Items',
  'ui.itemsOf': '{count} of 15 items',
  'ui.itemN': 'Item {n}',
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
  'ui.submit': 'Generate PDF',
  'ui.processing': 'Processing...',
  'ui.toastPreview': 'Invoice opened in a new tab',
  'ui.toastDownloaded': 'Invoice generated successfully',
  'ui.errorGeneric': 'Something went wrong, please try again.',
  'ui.errorMore': '…and {count} more',

  // ---- Live preview (chunk R5) ----
  'ui.preview': 'Preview',
  'ui.previewOpen': 'Open full preview',
  'ui.previewOpenAria': 'Open full preview',
  'ui.previewCloseAria': 'Close preview',

  // ---- Success flow (chunk R6) ----
  'ui.successTitle': 'Document ready',
  'ui.successBody': 'Your PDF was generated. Open it in a new tab or start a new document.',
  'ui.openPreview': 'Open preview',
  'ui.newDocument': 'New document',
  'ui.collapse': 'Collapse',
  'ui.expand': 'Expand',

  // API validation errors
  'error.documentTypeRequired': 'Document type is required',
  'error.documentTypeMax': 'Document type must be at most 60 characters',
  'error.companyObject': 'Company must be an object',
  'error.companyNameRequired': 'Company name is required',
  'error.companyNameMax': 'Company name must be at most 200 characters',
  'error.companyAddressMax': 'Company address must be at most 300 characters',
  'error.companyEmail': 'Company email must be a valid email address',
  'error.companyPhoneMax': 'Company phone must be at most 50 characters',
  'error.companyCityMax': 'Company city must be at most 100 characters',
  'error.clientObject': 'Client must be an object',
  'error.clientNameRequired': 'Client name is required',
  'error.clientNameMax': 'Client name must be at most 200 characters',
  'error.clientAddressMax': 'Client address must be at most 300 characters',
  'error.clientEmail': 'Client email must be a valid email address',
  'error.clientPhoneMax': 'Client phone must be at most 50 characters',
  'error.clientCityMax': 'Client city must be at most 100 characters',
  'error.issueDateRequired': 'Issue date is required',
  'error.dueDateMax': 'Due date must be at most 60 characters',
  'error.itemsArray': 'Items must be an array with at most 15 entries',
  'error.itemDescriptionRequired': 'Item description is required',
  'error.itemDescriptionMax': 'Item description must be at most 1000 characters',
  'error.itemPriceNumber': 'Item price must be a number',
  'error.itemQuantityNumber': 'Item quantity must be a number',
  'error.paymentTypeMax': 'Payment type must be at most 100 characters',
  'error.notesMax': 'Notes must be at most 2000 characters',
  'error.taxRateNumber': 'Tax rate must be a number',
  'error.currencyRequired': 'Currency is required',
  'error.currencyMax': 'Currency must be at most 8 characters',
  'error.languageInvalid': 'Language must be "en" or "fr"',
};
