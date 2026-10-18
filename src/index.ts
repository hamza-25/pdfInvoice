import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './logger';

const PORT = process.env.PORT || 8000;
const DOMAIN = process.env.DOMAIN || 'http://localhost';

app.listen(PORT, () => {
  logger.info(`Server is running on ${DOMAIN}:${PORT}`);
});
