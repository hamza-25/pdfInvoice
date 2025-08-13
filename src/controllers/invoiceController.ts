import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import {invoiceData, invoiceItem} from '../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { validationResult } from 'express-validator';



export const invoiceGenerate = async (req: Request, res: Response) => {
  try {
      const errors = validationResult(req);
      if(!errors.isEmpty()) {
        return res.status(400).render('index', { errors: errors.array(), old: req.body});
      }
      const data: invoiceData = req.body;
      data.number = uuidv4().split('-')[0];
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
      // data.items.forEach((element: invoiceItem) => {
      //   doc.text(element.description, 55, rowHeight).text(element.quantity, 350, rowHeight).text(`${element.price}${data.currency}`, 450, rowHeight);
      //   rowHeight += 15;
      //   total += parseFloat(element.price);
      // });

      // await (async () => {
      //   for (const element of data.items) {
      //     await new Promise<void>((resolve) => {
      //       doc.text(element.description, 55, rowHeight)
      //          .text(element.quantity, 350, rowHeight)
      //          .text(`${element.price}${data.currency}`, 450, rowHeight);
      //       rowHeight += 15;
      //       total += parseFloat(element.price);
      //       resolve();
      //     });
      //   }
      // })();

      await (async () => {
        for (const element of data.items) {
          doc.text(element.description, 55, rowHeight)
             .text(element.quantity, 350, rowHeight)
             .text(`${element.price}${data.currency}`, 450, rowHeight);
        
          rowHeight += 15;
          total += parseFloat(element.price);
        
          // Give pdfkit time to flush drawing commands
          await new Promise((r) => setImmediate(r));
        }
      })();

    
      // Tax
      const taxValue = (data.taxRate * total) / 100;
      doc.text(`Tax (${data.taxRate}%)`, 55, rowHeight/*350*/).text(`${taxValue.toFixed(2)}`, 450, rowHeight/*350*/);
    
      // Total
      rowHeight += 15; // Move to the next row for total
      doc
        .moveTo(50, /*380*/rowHeight)
        .lineTo(550, /*380*/rowHeight)
        .stroke();
      
      rowHeight += 15;
      doc.font('Helvetica-Bold').text('TOTAL', 400, rowHeight).text(`${total + taxValue}${data.currency}`, 450, rowHeight);
    
      // Footer
      rowHeight += 15;
      doc
        .font('Helvetica')
        .text('Thank you for your business!', 50, /*420*/rowHeight)
        .fontSize(8)
        .text('If you have any questions about this invoice, please contact Us', 50, rowHeight + 40)
        //.text('[Name, Phone, email@address.com]', 50, 470)
        .text(`[${data.company.name}, ${data.company.phone}, ${data.company.email}]`, 50, rowHeight + 50);
    
      doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    return res.status(500).render('index', error as any);
    // res.status(500).json({ error: 'Internal server error' });
  }
}