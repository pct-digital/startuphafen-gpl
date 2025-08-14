import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { ServerConfig } from '../../config';

export const buildLoginRouter = (serverConfig: ServerConfig) => {
  return router({
    loadRedirectHost: baseProcedure
      .meta({
        requiredRolesAny: ['anon'],
      })
      .input(z.void())
      .output(z.string())
      .query(async (_req) => {
        return serverConfig.allowedOrigins[0] != null
          ? serverConfig.allowedOrigins[0]
          : 'http://localhost:4000';
      }),
  });
};
