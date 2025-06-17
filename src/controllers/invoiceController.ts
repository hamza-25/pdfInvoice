import { Request, Response } from 'express';

export const invoiceGenerate = async (req: Request, res: Response) => {
    console.log(req.body);
    // console.log(10);
    res.render('index');
}