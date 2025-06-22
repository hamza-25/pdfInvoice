import express from 'express';
import {invoiceGenerate} from '../controllers/invoiceController';
import { pdfInputValidations } from '../validations/pdfInputValidations';

const router = express.Router();

router.post('/invoice-generate', pdfInputValidations, invoiceGenerate);

export default router;