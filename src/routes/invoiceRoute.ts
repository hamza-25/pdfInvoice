import express from 'express';
import {invoiceGenerate} from '../controllers/invoiceController';

const router = express.Router();

router.post('/invoice-generate', invoiceGenerate);

export default router;