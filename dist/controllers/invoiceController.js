"use strict";
// // import { Request, Response } from 'express';
// // import PDFDocument from 'pdfkit';
// // import {invoiceData, invoiceItem} from '../interfaces';
// // import { v4 as uuidv4 } from 'uuid';
// // import { validationResult } from 'express-validator';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceGenerate = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const uuid_1 = require("uuid");
const express_validator_1 = require("express-validator");
const invoiceGenerate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('index', {
                errors: errors.array(),
                old: req.body
            });
        }
        const data = req.body;
        data.number = (0, uuid_1.v4)().split('-')[0];
        const doc = new pdfkit_1.default({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=static-invoice.pdf');
        doc.pipe(res);
        // Header
        doc
            .fontSize(20)
            .text('INVOICE', 450, 50);
        // Company Info
        doc
            .fontSize(10)
            .text(data.company.name, 50, 50)
            .text(data.company.address, 50, 65)
            .text(data.company.city || '', 50, 80);
        // Invoice Info
        doc
            .text('INVOICE #:', 400, 100)
            .text(data.number, 470, 100)
            .text('DATE:', 400, 115)
            .text(data.issueDate, 470, 115);
        // Bill To Box
        doc
            .rect(50, 140, 200, 20)
            .fill('#e0e0e0')
            .stroke()
            .fillColor('black')
            .text('BILL TO', 55, 145);
        doc
            .fillColor('black')
            .text(data.client.name, 55, 165)
            .text(data.client.address || '', 55, 180)
            .text(data.client.city || '', 55, 195)
            .text(data.client.phone || '', 55, 210)
            .text(data.client.email || '', 55, 225);
        // Table Headers
        doc
            .moveTo(50, 270)
            .lineTo(550, 270)
            .stroke();
        doc
            .text('DESCRIPTION', 55, 275)
            .text('Quantity', 350, 275)
            .text('AMOUNT', 450, 275);
        doc
            .moveTo(50, 290)
            .lineTo(550, 290)
            .stroke();
        let rowHeight = 305;
        let total = 0;
        data.items.forEach((element) => {
            doc.text(element.description, 55, rowHeight).text(element.quantity, 350, rowHeight).text(element.price, 450, rowHeight);
            rowHeight += 15;
            total += parseFloat(element.price);
        });
        // Tax
        const taxValue = (data.taxRate * total) / 100;
        doc.text(`Tax (${data.taxRate}%)`, 55, rowHeight /*350*/).text(`${taxValue.toFixed(2)}`, 450, rowHeight /*350*/);
        // Total
        rowHeight += 15; // Move to the next row for total
        doc
            .moveTo(50, /*380*/ rowHeight)
            .lineTo(550, /*380*/ rowHeight)
            .stroke();
        rowHeight += 15;
        doc.font('Helvetica-Bold').text('TOTAL', 400, rowHeight).text(`${total + taxValue}`, 450, rowHeight);
        // Footer
        rowHeight += 15;
        doc
            .font('Helvetica')
            .text('Thank you for your business!', 50, /*420*/ rowHeight)
            .fontSize(8)
            .text('If you have any questions about this invoice, please contact Us', 50, rowHeight + 40)
            //.text('[Name, Phone, email@address.com]', 50, 470)
            .text(`[${data.company.name}, ${data.company.phone}, ${data.company.email}]`, 50, rowHeight + 50);
        doc.end();
    }
    catch (error) {
        console.error('Error generating invoice:', error);
        return res.status(500).render('index', error);
        // res.status(500).json({ error: 'Internal server error' });
    }
});
exports.invoiceGenerate = invoiceGenerate;
