import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
import invoiceRoutes from './routes/invoiceRoute';
import PDFDocument from 'pdfkit';


const app = express();
const PORT = process.env.PORT || 8000;
const DOMAIN = process.env.DOMAIN || 'http://localhost';
const rootDir = process.cwd();
app.set('view engine', 'ejs');
app.use(express.static(path.join(rootDir, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.render('index');
});
app.use('/pdf', invoiceRoutes);

// app.post('/download-pdf', (req, res) => {
//   const doc = new PDFDocument();

//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');

//   doc.pipe(res);

//   doc.fontSize(25).text('Invoice', { align: 'center' });
//   doc.moveDown().fontSize(12).text('Customer: John Doe');
//   doc.text('Date: 2025-06-17');
//   doc.moveDown().text('Item     Qty     Price');
//   doc.text('T-Shirt   2      $20.00');
//   doc.text('Shoes     1      $50.00');
//   doc.moveDown().font('Helvetica-Bold').text('Total: $90.00');

//   doc.end(); // finalize PDF
// });

app.listen(PORT, () => {
  console.log(`Server is running on ${DOMAIN}:${PORT}`);
});