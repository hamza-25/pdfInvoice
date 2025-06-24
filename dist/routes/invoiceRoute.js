"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const invoiceController_1 = require("../controllers/invoiceController");
const pdfInputValidations_1 = require("../validations/pdfInputValidations");
const router = express_1.default.Router();
router.post('/invoice-generate', pdfInputValidations_1.pdfInputValidations, invoiceController_1.invoiceGenerate);
exports.default = router;
