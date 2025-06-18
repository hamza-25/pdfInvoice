import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';

interface InvoiceItem {
  name: string;
  qty: number;
  price: number;
}
interface InvoiceData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  date: string;
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  items: InvoiceItem[];
}

export const invoiceGenerate = async (req: Request, res: Response) => {

// const data = {
//     invoiceNumber: 'INV-2025-001',
//     customerName: 'Hamza Ich',
//     customerEmail: 'hamza@example.com',
//     date: '2025-06-17',
//     companyName: 'Matjarify Inc.',
//     companyEmail: 'support@matjarify.com',
//     companyAddress: '123 Startup St, Casablanca, MA',
//     items: [
//       { name: 'T-Shirt', qty: 2, price: 25 },
//       { name: 'Shoes', qty: 1, price: 60 },
//       { name: 'Cap', qty: 3, price: 10 },
//     ],
//   };
  
// const doc = new PDFDocument({ margin: 50 });

//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', 'inline; filename=invoice.pdf');
//   doc.pipe(res);

//   addHeader(doc, data);
//   addCustomerInfo(doc, data);
//   addTable(doc, data.items);
//   addFooter(doc);

//   doc.end();
// }

// // --- Sections ---

// function addHeader(doc: PDFKit.PDFDocument, data: InvoiceData) {
//   doc
//     .fontSize(20)
//     .fillColor('#333333')
//     .text(data.companyName, 50, 45)
//     .fontSize(10)
//     .fillColor('#666666')
//     .text(data.companyAddress, 50, 70)
//     .text(`Email: ${data.companyEmail}`, 50, 85);
// }

// function addCustomerInfo(doc: PDFKit.PDFDocument, data: InvoiceData) {
//   doc
//     .moveDown()
//     .fontSize(12)
//     .fillColor('#000000')
//     .text(`Invoice #: ${data.invoiceNumber}`, 50, 130)
//     .text(`Date: ${data.date}`)
//     .moveDown()
//     .text(`Billed To: ${data.customerName}`)
//     .text(`Email: ${data.customerEmail}`);
// }

// function addTable(doc: PDFKit.PDFDocument, items: InvoiceItem[]) {
//   const startY = 220;
//   const rowHeight = 20;
//   let y = startY;

//   doc
//     .font('Helvetica-Bold')
//     .fontSize(10)
//     .fillColor('#000000')
//     .text('Item', 50, y)
//     .text('Qty', 250, y)
//     .text('Price', 300, y)
//     .text('Total', 400, y);

//   doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
//   y += 25;

//   doc.font('Helvetica').fillColor('#333333');

//   let grandTotal = 0;

//   items.forEach((item) => {
//     const total = item.qty * item.price;
//     grandTotal += total;

//     doc
//       .text(item.name, 50, y)
//       .text(item.qty.toString(), 250, y)
//       .text(`$${item.price.toFixed(2)}`, 300, y)
//       .text(`$${total.toFixed(2)}`, 400, y);
//     y += rowHeight;
//   });

//   doc
//     .font('Helvetica-Bold')
//     .fillColor('#000000')
//     .text(`Total: $${grandTotal.toFixed(2)}`, 400, y + 10);
// }

// function addFooter(doc: PDFKit.PDFDocument) {
//   doc
//     .fontSize(10)
//     .fillColor('#999999')
//     .text(
//       'Thank you for your business!',
//       50,
//       doc.page.height - 50,
//       { align: 'center' }
//     );
// step 2
console.log(req.body);
const data = req.body;
const doc = new PDFDocument({ margin: 50 });

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
    .text(data.company.city || '', 50, 80)
    .text(data.company.phone || '', 50, 95);

  // Invoice Info
  doc
    .text('INVOICE #:', 400, 100)
    .text(data.number, 470, 100)
    .text('DATE:', 400, 115)
    .text(data.issueData, 470, 115);

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
    .text(data.client.company || '', 55, 180)
    .text(data.client.address || '', 55, 195)
    .text(data.company.city || '', 55, 210)
    .text(data.company.phone || '', 55, 225)
    .text(data.company.email || '', 55, 240);

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

  // Table Content
  // doc.text('Service Fee', 55, 305).text('200.00', 450, 305);
  // doc.text('Labor: 5 hours at $75/hr', 55, 320).text('375.00', 450, 320);
  // doc.text('New client discount', 55, 335).text('(60.00)', 450, 335);
  interface elementType {
    description: string;
    price: string;
    quantity: string;
  }
  let rowHeight = 305;
  let total = 0;
  data.items.forEach((element: elementType) => {
    doc.text(element.description, 55, rowHeight).text(element.quantity, 350, rowHeight).text(element.price, 450, rowHeight);
    rowHeight += 15;
    total += parseFloat(element.price);
  });

  // Tax
  const taxValue = (data.taxRate * total) / 100;
  doc.text(`Tax (${data.taxRate}%)`, 55, 350).text(`${taxValue}`, 450, 350);

  // Total
  doc
    .moveTo(50, 380)
    .lineTo(550, 380)
    .stroke();

  doc.font('Helvetica-Bold').text('TOTAL', 400, 390).text(`${total + taxValue}`, 450, 390);

  // Footer
  doc
    .font('Helvetica')
    .text('Thank you for your business!', 50, 420)
    .fontSize(8)
    .text('If you have any questions about this invoice, please contact Us', 50, 460)
    .text('[Name, Phone, email@address.com]', 50, 470);

  doc.end();
}