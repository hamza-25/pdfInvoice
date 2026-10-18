import { body } from 'express-validator';
import { stripControlChars } from '../utils/sanitize';

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
    .withMessage('Document type is required')
    .isLength({ max: 60 })
    .withMessage('Document type must be at most 60 characters'),

  body('company').isObject().withMessage('Company must be an object'),
  body('company.name')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage('Company name is required')
    .isLength({ max: 200 })
    .withMessage('Company name must be at most 200 characters'),
  body('company.address')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 300 })
    .withMessage('Company address must be at most 300 characters'),
  body('company.email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Company email must be a valid email address')
    .normalizeEmail(),
  body('company.phone')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 50 })
    .withMessage('Company phone must be at most 50 characters'),
  body('company.city')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 100 })
    .withMessage('Company city must be at most 100 characters'),

  body('client').isObject().withMessage('Client must be an object'),
  body('client.name')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage('Client name is required')
    .isLength({ max: 200 })
    .withMessage('Client name must be at most 200 characters'),
  body('client.address')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 300 })
    .withMessage('Client address must be at most 300 characters'),
  body('client.email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Client email must be a valid email address')
    .normalizeEmail(),
  body('client.phone')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 50 })
    .withMessage('Client phone must be at most 50 characters'),
  body('client.city')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 100 })
    .withMessage('Client city must be at most 100 characters'),

  body('issueDate')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage('Issue date is required'),

  body('dueDate')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 60 })
    .withMessage('Due date must be at most 60 characters'),

  body('items').isArray({ max: 15 }).withMessage('Items must be an array with at most 15 entries'),

  body('items.*.description')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage('Item description is required')
    .isLength({ max: 1000 })
    .withMessage('Item description must be at most 1000 characters'),
  body('items.*.price').isNumeric().withMessage('Item price must be a number'),
  body('items.*.quantity').isNumeric().withMessage('Item quantity must be a number'),

  body('paymentType')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 100 })
    .withMessage('Payment type must be at most 100 characters'),

  body('notes')
    .optional()
    .trim()
    .customSanitizer(stripControlChars)
    .isLength({ max: 2000 })
    .withMessage('Notes must be at most 2000 characters'),

  body('taxRate').isNumeric().withMessage('Tax rate must be a number'),

  body('currency')
    .trim()
    .customSanitizer(stripControlChars)
    .notEmpty()
    .withMessage('Currency is required')
    .isLength({ max: 8 })
    .withMessage('Currency must be at most 8 characters'),
];
