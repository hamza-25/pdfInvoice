import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './logger';

const PORT = process.env.PORT || 8000;
const DOMAIN = process.env.DOMAIN || 'http://localhost';

const server = app.listen(PORT, () => {
  logger.info(`Server is running on ${DOMAIN}:${PORT}`);
});

/** How long in-flight requests get to finish before the process is killed. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Stop accepting new connections and let in-flight requests drain. */
const shutdown = (signal: NodeJS.Signals): void => {
  logger.info(`${signal} received: shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error('Forcing shutdown: in-flight requests did not finish in time');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error while closing server');
      process.exit(1);
    }
    logger.info('All connections closed, exiting');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
