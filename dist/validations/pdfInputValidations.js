"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfInputValidations = void 0;
const express_validator_1 = require("express-validator");
exports.pdfInputValidations = [
    (0, express_validator_1.body)('documentType').trim().notEmpty().withMessage('Document type is required').escape(),
    (0, express_validator_1.body)('company').isObject().withMessage('Company must be an object'),
    (0, express_validator_1.body)('company.name').trim().notEmpty().withMessage('Company name is required').escape(),
    (0, express_validator_1.body)('company.address').trim().notEmpty().withMessage('Company address is required').escape(),
    (0, express_validator_1.body)('company.email').isEmail().withMessage('Company email must be a valid email address').normalizeEmail(),
    (0, express_validator_1.body)('company.phone').trim().notEmpty().withMessage('Company phone is required').escape(),
    (0, express_validator_1.body)('company.city').trim().notEmpty().withMessage('Company city is required').escape(),
    (0, express_validator_1.body)('client').isObject().withMessage('Company must be an object'),
    (0, express_validator_1.body)('client.name').trim().notEmpty().withMessage('Client name is required').escape(),
    (0, express_validator_1.body)('client.address').trim().notEmpty().withMessage('Client address is required').escape(),
    (0, express_validator_1.body)('client.email').isEmail().withMessage('Client email must be a valid email address').normalizeEmail(),
    (0, express_validator_1.body)('client.phone').trim().notEmpty().withMessage('Client phone is required').escape(),
    (0, express_validator_1.body)('client.city').trim().notEmpty().withMessage('Client city is required').escape(),
    (0, express_validator_1.body)('issueDate').trim().notEmpty().withMessage('issueDate name is required').escape(),
    (0, express_validator_1.body)('dueDate').optional().trim().escape(),
    (0, express_validator_1.body)('items').isArray().withMessage('Items must be an array'),
    (0, express_validator_1.body)('items.*.description').trim().notEmpty().withMessage('description required').escape(),
    (0, express_validator_1.body)('items.*.price').isNumeric().withMessage('Item price must be a number'),
    (0, express_validator_1.body)('items.*.quantity').isNumeric().withMessage('Item price must be a number'),
    (0, express_validator_1.body)('paymentType').trim().notEmpty().withMessage('Payment type is required').escape(),
    (0, express_validator_1.body)('notes').optional().trim().escape(),
    (0, express_validator_1.body)('taxRate').isNumeric().withMessage('Tax rate must be a number'),
    (0, express_validator_1.body)('subtotal').isNumeric().withMessage('Subtotal must be a number'),
    (0, express_validator_1.body)('total').isNumeric().withMessage('Total must be a number'),
    (0, express_validator_1.body)('currency').trim().notEmpty().withMessage('Currency is required').escape(),
];
