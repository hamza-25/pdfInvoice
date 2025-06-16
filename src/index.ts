import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();


const app = express();
const PORT = process.env.PORT || 8000;
const DOMAIN = process.env.DOMAIN || 'http://localhost';
app.set('view engine', 'ejs');

app.get('/', (req: Request, res: Response) => {
  res.render('index');
});

app.post('/invoice-generate', (req: Request, res: Response) => {
    console.log(req.body);
    res.render('index');
});

app.listen(PORT, () => {
  console.log(`Server is running on ${DOMAIN}:${PORT}`);
});