import express from 'express';
import { Request, Response } from 'express';
import path from 'path';
import invoiceRoutes from './routes/invoiceRoute';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const rootDir = process.cwd();

app.set('view engine', 'ejs');
app.use(express.static(path.join(rootDir, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.render('index');
});

app.use('/pdf', invoiceRoutes);

// Terminal error handler: converts thrown/rejected errors into a JSON 500.
app.use(errorHandler);

export default app;
