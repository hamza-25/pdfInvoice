import express, { Request, RequestHandler, Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from './logger';
import invoiceRoutes from './routes/invoiceRoute';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.set('view engine', 'ejs');

// Structured access logging with a request id per line.
app.use(
  pinoHttp({
    logger,
    genReqId: () => randomUUID(),
    // The health probe fires every few seconds — keep it out of the access log.
    autoLogging: { ignore: (req) => req.url === '/health' },
    customLogLevel: (_req, res) =>
      res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  }),
);

// Security headers. The CSP is tuned for the served page, which loads the
// Tailwind CDN, Google Fonts and an inline <script> block.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }),
);

// Explicit same-origin stance: reject cross-origin requests outright.
// Browsers only attach an Origin header to cross-origin (or non-GET) requests,
// so this never affects normal navigation to the form.
const sameOriginOnly: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) {
    return next();
  }
  try {
    if (new URL(origin).host !== req.headers.host) {
      res.status(403).json({ error: 'Cross-origin requests are not allowed' });
      return;
    }
  } catch {
    res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    return;
  }
  next();
};

app.use(sameOriginOnly);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '200kb' }));

// Rate limit the PDF endpoint only: 10 requests/minute/IP.
// Disabled under test so the suite never flakes.
const pdfLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/pdf', pdfLimiter);

app.get('/', (_req: Request, res: Response) => {
  res.render('index');
});

app.use('/pdf', invoiceRoutes);

// Terminal error handler: converts thrown/rejected errors into a JSON 500.
app.use(errorHandler);

export default app;
