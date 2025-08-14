import { trpcBuilder } from './init';
import {
  authMiddleware,
  loggingMiddleware,
  longCallsLoggerMiddleware,
  upsertUserMiddleware,
} from './middleware';

export * from './constants';
export * from './context';
export * from './entities';
export * from './errors';
export * from './init';
export * from './lib/process-argument-params';
export * from './middleware';
export * from './openid';

export const middleware = trpcBuilder.middleware;
export const router = trpcBuilder.router;
export const mergeRouters = trpcBuilder.mergeRouters;
export const baseProcedure = trpcBuilder.procedure
  .use(longCallsLoggerMiddleware)
  .use(authMiddleware)
  .use(upsertUserMiddleware)
  .use(loggingMiddleware);
