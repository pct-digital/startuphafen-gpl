import { DbMigrator } from '@startuphafen/db-migration';
import { createRepeatedSerializedKnexTransaction } from '@startuphafen/serialized-transaction';
import { VERSION } from '@startuphafen/startuphafen-common';
import {
  buildTokenInformationForRequestFunction,
  logServerSideError,
  readConfigValueFrom,
} from '@startuphafen/trpc-root';
import { CONFIG_TYPE, prepServerStart } from '@startuphafen/utility-server';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import cors from 'cors';
import express from 'express';
import knex from 'knex';
import _ from 'lodash';
import { promises as fs } from 'node:fs';
import { IncomingMessage } from 'node:http';
import { getAssetPath } from './assets-loader';
import {
  LocalSecrets,
  ServerConfig,
  loadLocalSecrets,
  loadServerConfiguration,
} from './config';
import { createE2ERoutes } from './e2e-utilites/e2e-routes';
import { createAppRouter } from './router';
// import { MailClient } from './features/common/mail';

prepServerStart(VERSION);

(async () => {
  const configType = (readConfigValueFrom(process.argv, '--config') ??
    'dev') as CONFIG_TYPE;
  const config: ServerConfig = await loadServerConfiguration(configType);
  const localSecrets: LocalSecrets = await loadLocalSecrets(
    configType === 'e2e'
  );

  try {
    const debugConfigOutput = getAssetPath('debug_config_output.json');
    await fs.writeFile(debugConfigOutput, JSON.stringify(config, undefined, 2));
    console.log(
      'Wrote full configuration for debugging access to ' + debugConfigOutput
    );
  } catch (error) {
    console.log('Failed to write debug full config for some reason?', error);
  }

  console.log('!!! Mail config is', _.omit(config.mail, 'password'));

  const kx = knex(config.knex);

  const dbMigration = new DbMigrator(
    config.dbMigration,
    kx,
    __dirname,
    configType
  );
  await dbMigration.migrate();

  const host = config.express.host;
  const port = config.express.port;

  let counter = 0;

  const app = express();

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

  app.listen(port, host, () => {
    console.log(`[ ready ] http://${host}:${port}`);
  });

  // const mailClient = new MailClient(config.mail);

  const trxFactory = createRepeatedSerializedKnexTransaction(kx);
  const tokenFactory = buildTokenInformationForRequestFunction(
    config.keycloak.jwksUri
  );

  async function createContext(opts: CreateNextContextOptions) {
    const msg: IncomingMessage = opts.req;
    const token = await tokenFactory(msg);
    return { trxFactory, token };
  }

  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: createAppRouter(config, localSecrets),
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
      '!!! This server is running in e2e mode, it provides non authenticated full access to the database !!!'
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
})();
