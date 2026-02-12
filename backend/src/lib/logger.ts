import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
});

export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req(request: IncomingMessage & { id?: string | number }) {
      return {
        id: request.id,
        method: request.method,
        url: request.url,
      };
    },
  },
});
