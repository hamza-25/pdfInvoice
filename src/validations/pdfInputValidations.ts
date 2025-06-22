import { body } from 'express-validator';

export const pdfInputValidations = [
  body('documentType').trim().notEmpty().withMessage('Document type is required').escape(),
  
  body('company').isObject().withMessage('Company must be an object'),
  body('company.name').trim().notEmpty().withMessage('Company name is required').escape(),
  body('company.address').trim().notEmpty().withMessage('Company address is required').escape(),
  body('company.email').isEmail().withMessage('Company email must be a valid email address').normalizeEmail(),
  body('company.phone').trim().notEmpty().withMessage('Company phone is required').escape(),
  body('company.city').trim().notEmpty().withMessage('Company city is required').escape(),



  body('client').isObject().withMessage('Company must be an object'),
  body('client.name').trim().notEmpty().withMessage('Client name is required').escape(),
  body('client.address').trim().notEmpty().withMessage('Client address is required').escape(),
  body('client.email').isEmail().withMessage('Client email must be a valid email address').normalizeEmail(),
  body('client.phone').trim().notEmpty().withMessage('Client phone is required').escape(),
  body('client.city').trim().notEmpty().withMessage('Client city is required').escape(),
  

  body('issueDate').trim().notEmpty().withMessage('issueDate name is required').escape(),

  body('dueDate').optional().trim().escape(),

  body('items').isArray().withMessage('Items must be an array'),

  body('items.*.description').trim().notEmpty().withMessage('description required').escape(),
  body('items.*.price').isNumeric().withMessage('Item price must be a number'),
  body('items.*.quantity').isNumeric().withMessage('Item price must be a number'),

  body('paymentType').trim().notEmpty().withMessage('Payment type is required').escape(),

  body('notes').optional().trim().escape(),

  body('taxRate').isNumeric().withMessage('Tax rate must be a number'),

  body('subtotal').isNumeric().withMessage('Subtotal must be a number'),

  body('total').isNumeric().withMessage('Total must be a number'),

  body('currency').trim().notEmpty().withMessage('Currency is required').escape(),
];