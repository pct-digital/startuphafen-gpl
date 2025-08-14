import { baseProcedure, router } from '@startuphafen/trpc-root';
import { clearDatabase } from '@startuphafen/utility-server';
import { z } from 'zod';
import { ServerConfig } from '../config';

export function createE2ERoutes(serverConfig: ServerConfig) {
  const appRouter = router({
    hello: baseProcedure
      .meta({ requiredRolesAny: ['anon'] })
      .input(z.string())
      .output(z.string())
      .query(async (req) => {
        return 'Hello ' + req.input;
      }),
    resetDatabaseAndStopServer: baseProcedure
      .meta({ requiredRolesAny: ['anon'] })
      .input(z.void())
      .output(z.boolean())
      .mutation(async (_req) => {
        try {
          console.log('Call to /resetDatabaseAndStopServer!');
          console.log('Clearing database');
          await clearDatabase(serverConfig.knex);
          console.log('Shutting down server');
          process.exit(0);
        } catch (e) {
          console.log('FAILED /resetDatabaseAndStopServer', e);
          return false;
        }
      }),
    ping: baseProcedure
      .meta({ requiredRolesAny: ['anon'] })
      .input(z.void())
      .output(z.string())
      .query(async (_req) => {
        return 'pong';
      }),
  });

  return appRouter;
}

export type E2eRoutes = ReturnType<typeof createE2ERoutes>;
