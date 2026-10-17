import express from 'express';
import { Request, Response } from 'express';
import invoiceRoutes from './routes/invoiceRoute';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.render('index');
});

app.use('/pdf', invoiceRoutes);

// Terminal error handler: converts thrown/rejected errors into a JSON 500.
app.use(errorHandler);

export default app;
