require('console-stamp')(console, {
  format: ':date(yyyy-mm-dd HH:MM:ss.l)',
});

import { createRepeatedSerializedKnexTransaction } from '@startuphafen/serialized-transaction';
import { VERSION } from '@startuphafen/startuphafen-common';
import {
  buildTokenInformationForRequestFunction,
  logServerSideError,
  readConfigValueFrom,
  redactSecrets,
} from '@startuphafen/trpc-root';
import { CONFIG_TYPE, prepServerStart } from '@startuphafen/utility-server';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import cors from 'cors';
import helmet from 'helmet';
import knex from 'knex';
import { promises as fs } from 'node:fs';
import { IncomingMessage } from 'node:http';
import { getAssetPath, migrateDatabase } from './assets-loader';
import { loadServerConfiguration, ServerConfig } from './config';
import { createE2ERoutes } from './e2e-utilities/e2e-routes';
import { HwkMailScheduler } from './features/hwk-form/hwk-mail-scheduler';
import { HwkMailService } from './features/hwk-form/hwk-mail-service';
import { ProjectCleanupScheduler } from './features/project-cleanup/project-cleanup-scheduler';
import { ProjectCleanupService } from './features/project-cleanup/project-cleanup-service';
import { createAppRouter } from './router';

prepServerStart(VERSION);

(async () => {
  const configType = (readConfigValueFrom(process.argv, '--config') ??
    'dev') as CONFIG_TYPE;
  const config: ServerConfig = await loadServerConfiguration(configType);

  const { default: express } = await import('express');

  try {
    const debugConfigOutput = getAssetPath('debug_config_output.json');
    // Secrets (passwords, tokens, api keys) are redacted before writing.
    await fs.writeFile(
      debugConfigOutput,
      JSON.stringify(config, redactSecrets, 2)
    );
    console.log(
      'Wrote redacted configuration for debugging access to ' +
        debugConfigOutput
    );
  } catch (error) {
    console.log('Failed to write debug full config for some reason?', error);
  }

  // Log ERiC and OZG service status
  console.log('--- ERiC Service Status ---');
  console.log(`  Host: ${config.eric.host || '(not configured)'}`);
  console.log(`  Dev Mode: ${config.eric.devMode}`);
  console.log(
    `  Placeholder: ${
      config.eric.placeholder
        ? config.eric.placeholder
        : '(disabled - real API calls enabled)'
    }`
  );
  console.log(`Finanzämter currently configured: ${config.eric.finanzaemter}`);

  console.log('--- OZG Service Status ---');
  console.log(`  Host: ${config.ozg.host || '(not configured)'}`);
  console.log(
    `  Placeholder: ${
      config.ozg.placeholder
        ? config.ozg.placeholder
        : '(disabled - real API calls enabled)'
    }`
  );

  const kx = knex(config.knex);

  await migrateDatabase(kx, false);

  const host = config.express.host;
  const port = config.express.port;

  let counter = 0;

  const app = express();

  app.use(helmet());

  const corsHandler = cors({
    origin: (origin, callback) => {
      const localWhitelist = [
        'http://localhost',
        'http://localhost:3000',
        'https://localhost',
        'https://localhost:4000',
        'http://localhost:4000',
      ];
      const hostWhitelist = config.allowedOrigins;
      const hit =
        origin == null ||
        localWhitelist.find((w) => origin === w) != null ||
        hostWhitelist.find((h) => origin === h);
      if (hit) {
        callback(null, true);
      } else {
        callback(new Error('not allowed by cors: ' + origin));
      }
    },
  });

  app.options('*', corsHandler);
  app.use(corsHandler);

  app.get('/', (_req, res) => {
    res.send({ message: 'Hello Server ' + counter });
    counter++;
  });

  const trxFactory = createRepeatedSerializedKnexTransaction(kx);
  const tokenFactory = buildTokenInformationForRequestFunction(
    config.keycloak.jwksUri,
    undefined,
    undefined,
    undefined,
    {
      realm: config.keycloak.realm,
      clientId: config.keycloak.clientId,
    }
  );

  const hwkMailService = new HwkMailService(config, trxFactory);
  const hwkMailScheduler = new HwkMailScheduler(hwkMailService);
  hwkMailScheduler.start();

  const projectCleanupService = new ProjectCleanupService(trxFactory);
  const projectCleanupScheduler = new ProjectCleanupScheduler(
    projectCleanupService
  );
  projectCleanupScheduler.start();

  async function createContext(opts: CreateNextContextOptions) {
    const msg: IncomingMessage = opts.req;
    const token = await tokenFactory(msg);
    const authHeader = msg.headers.authorization;
    const bearerPrefix = 'Bearer ';
    const rawToken =
      authHeader != null && authHeader.startsWith(bearerPrefix)
        ? authHeader.substring(bearerPrefix.length).trim()
        : undefined;
    const origin = msg.headers.origin;
    return { trxFactory, token, rawToken, origin };
  }

  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: createAppRouter(config),
      createContext,
      maxBodySize: 10e6,
      onError(opts) {
        logServerSideError(
          opts.error,
          opts.type,
          opts.path,
          opts.input,
          opts.ctx
        );
      },
    })
  );

  if (configType === 'e2e') {
    console.log(
      '!!! This server is running in e2e mode with test helper routes enabled !!!'
    );
    app.use(
      '/e2e',
      trpcExpress.createExpressMiddleware({
        router: createE2ERoutes(config),
        createContext,
        maxBodySize: 10e6,
        onError(opts) {
          logServerSideError(
            opts.error,
            opts.type,
            opts.path,
            opts.input,
            opts.ctx
          );
        },
      })
    );
  }

  app.use(function onError(_err: any, _req: any, res: any, _next: any) {
    res.statusCode = 500;
    res.end('Internal Server Error\n');
  });

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });
})();
