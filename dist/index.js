"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const invoiceRoute_1 = __importDefault(require("./routes/invoiceRoute"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8000;
const DOMAIN = process.env.DOMAIN || 'http://localhost';
const rootDir = process.cwd();
app.set('view engine', 'ejs');
app.use(express_1.default.static(path_1.default.join(rootDir, 'public')));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.render('index');
});
app.use('/pdf', invoiceRoute_1.default);
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
