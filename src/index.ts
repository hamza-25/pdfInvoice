import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
import invoiceRoutes from './routes/invoiceRoute';

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

app.listen(PORT, () => {
  console.log(`Server is running on ${DOMAIN}:${PORT}`);
});