import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestContext } from './middleware/request-context';
import { requestLogger } from './middleware/request-logger';
import { rateLimit } from './middleware/rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import usersRoutes from './modules/users/users.routes';
import partiesRoutes from './modules/parties/parties.routes';
import { env } from './config/env';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  if (env.NODE_ENV === 'development') {
    app.use(cors({ origin: '*', credentials: false }));
  } else {
    app.use(helmet());
    app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((x) => x.trim()), credentials: false }));
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);
  app.use(requestLogger);
  app.use(rateLimit());

  app.get('/health/live', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/v1/users', usersRoutes);
  app.use('/v1/parties', partiesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
