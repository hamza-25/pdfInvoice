import { body } from 'express-validator';
import type { Request } from 'express';
import { stripControlChars } from '../utils/sanitize';
import { t, resolveLanguage, type TranslationKey } from '../services/i18n';

/**
 * Translate a validation message by the `language` of the request body.
 * An unknown/missing language falls back to English, so the classic
 * English-only clients keep seeing exactly what they saw before.
 */
const msg =
  (key: TranslationKey) =>
  (_value: unknown, meta: { req: Request }): string =>
    t(key, resolveLanguage(meta.req.body?.language));

/**
 * Text fields destined for the PDF: strip control characters, then enforce a
 * sensible length cap. (`.escape()` was deliberately removed — HTML-escaping
 * corrupts legitimate input like `O'Brien` without protecting a PDF.)
 */
export const pdfInputValidations = [
  body('documentType')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage(msg('error.documentTypeRequired'))
    .isLength({ max: 60 })
    .withMessage(msg('error.documentTypeMax')),

  body('company').isObject().withMessage(msg('error.companyObject')),
  body('company.name')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage(msg('error.companyNameRequired'))
    .isLength({ max: 200 })
    .withMessage(msg('error.companyNameMax')),
  body('company.address')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 300 })
    .withMessage(msg('error.companyAddressMax')),
  body('company.email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage(msg('error.companyEmail'))
    .normalizeEmail(),
  body('company.phone')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 50 })
    .withMessage(msg('error.companyPhoneMax')),
  body('company.city')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 100 })
    .withMessage(msg('error.companyCityMax')),

  body('client').isObject().withMessage(msg('error.clientObject')),
  body('client.name')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage(msg('error.clientNameRequired'))
    .isLength({ max: 200 })
    .withMessage(msg('error.clientNameMax')),
  body('client.address')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 300 })
    .withMessage(msg('error.clientAddressMax')),
  body('client.email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage(msg('error.clientEmail'))
    .normalizeEmail(),
  body('client.phone')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 50 })
    .withMessage(msg('error.clientPhoneMax')),
  body('client.city')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 100 })
    .withMessage(msg('error.clientCityMax')),

  body('issueDate')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage(msg('error.issueDateRequired')),

  body('dueDate')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 60 })
    .withMessage(msg('error.dueDateMax')),

  body('items').isArray({ max: 15 }).withMessage(msg('error.itemsArray')),

  body('items.*.description')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage(msg('error.itemDescriptionRequired'))
    .isLength({ max: 1000 })
    .withMessage(msg('error.itemDescriptionMax')),
  body('items.*.price').isNumeric().withMessage(msg('error.itemPriceNumber')),
  body('items.*.quantity').isNumeric().withMessage(msg('error.itemQuantityNumber')),

  body('paymentType')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 100 })
    .withMessage(msg('error.paymentTypeMax')),

  body('notes')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 2000 })
    .withMessage(msg('error.notesMax')),

  body('taxRate').isNumeric().withMessage(msg('error.taxRateNumber')),

  body('currency')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage(msg('error.currencyRequired'))
    .isLength({ max: 8 })
    .withMessage(msg('error.currencyMax')),

  body('language').optional().trim().isIn(['en', 'fr']).withMessage(msg('error.languageInvalid')),
];
