import { body } from 'express-validator';

export const pdfInputValidations = [
  body('documentType').trim().notEmpty().withMessage('Document type is required').escape(),

  body('company').isObject().withMessage('Company must be an object'),
  body('company.name').trim().notEmpty().withMessage('Company name is required').escape(),
  body('company.address').optional().trim().escape(),
  body('company.email').optional({ values: 'falsy' }).isEmail().withMessage('Company email must be a valid email address').normalizeEmail(),
  body('company.phone').optional().trim().escape(),
  body('company.city').optional().trim().escape(),

  body('client').isObject().withMessage('Client must be an object'),
  body('client.name').trim().notEmpty().withMessage('Client name is required').escape(),
  body('client.address').optional().trim().escape(),
  body('client.email').optional({ values: 'falsy' }).isEmail().withMessage('Client email must be a valid email address').normalizeEmail(),
  body('client.phone').optional().trim().escape(),
  body('client.city').optional().trim().escape(),

  body('issueDate').trim().notEmpty().withMessage('Issue date is required').escape(),

  body('dueDate').optional().trim().escape(),

  body('items').isArray().withMessage('Items must be an array'),

  body('items.*.description').trim().notEmpty().withMessage('Item description is required').escape(),
  body('items.*.price').isNumeric().withMessage('Item price must be a number'),
  body('items.*.quantity').isNumeric().withMessage('Item quantity must be a number'),

  body('paymentType').optional().trim().escape(),

  body('notes').optional().trim().escape(),

  body('taxRate').isNumeric().withMessage('Tax rate must be a number'),

  body('currency').trim().notEmpty().withMessage('Currency is required').escape(),
];
