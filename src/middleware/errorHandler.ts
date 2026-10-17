import { ErrorRequestHandler } from 'express';

/**
 * Terminal error handler. Any error that reaches the end of the middleware
 * chain produces a JSON 500 (or is delegated to Express if the response has
 * already started streaming, e.g. a PDF mid-flight).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error('Unhandled error:', err);
  return void res.status(500).json({ error: 'Internal server error' });
};
