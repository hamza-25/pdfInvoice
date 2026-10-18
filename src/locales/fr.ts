import type { Dictionary } from './en';

/**
 * French translation dictionary.
 *
 * The `Dictionary` type makes this compile-time guaranteed to stay in sync
 * with English: adding a key to `en.ts` breaks this file until it is added
 * here too (and a unit test asserts parity at runtime).
 *
 * All glyphs used here (é, è, ç, À, Ç, «») are WinAnsi-encodable, so
 * PDFKit's standard fonts render them without issue.
 */
export const fr: Dictionary = {
  'pdf.invoice.title': 'FACTURE',
  'pdf.invoice.idLabel': 'FACTURE #',
  'pdf.quote.title': 'DEVIS',
  'pdf.quote.idLabel': 'DEVIS #',
  'pdf.receipt.title': 'REÇU',
  'pdf.receipt.idLabel': 'REÇU #',
  'pdf.date.invoice': 'DATE',
  'pdf.date.quote': "VALIDE JUSQU'AU",
  'pdf.date.receipt': 'REÇU LE',
  'pdf.billTo': 'FACTURER À',
  'pdf.column.description': 'DESCRIPTION',
  'pdf.column.quantity': 'Quantité',
  'pdf.column.amount': 'MONTANT',
  'pdf.tax': 'Taxe',
  'pdf.total': 'TOTAL',
  'pdf.thanks': 'Merci pour votre affaire !',
  'pdf.contactNote': 'Si vous avez des questions concernant cette facture, veuillez nous contacter',
  'pdf.pageOf': 'Page {current} sur {total}',
};
