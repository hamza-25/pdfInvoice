import { ErrorRequestHandler } from 'express';

/**
 * Terminal error handler. Maps known body-parser failures to their proper
 * status codes and produces a JSON error for anything else (or is delegated
 * to Express if the response has already started streaming, e.g. a PDF
 * mid-flight).
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Body-parser failures carry a `type` and their own status code.
  const bodyErrorType = (err as { type?: string }).type;
  if (bodyErrorType === 'entity.too.large') {
    return void res.status(413).json({ error: 'Payload too large' });
  }
  if (bodyErrorType === 'entity.parse.failed') {
    return void res.status(400).json({ error: 'Malformed JSON body' });
  }

  req.log?.error({ err }, 'unhandled error');
  return void res.status(500).json({ error: 'Internal server error' });
};
