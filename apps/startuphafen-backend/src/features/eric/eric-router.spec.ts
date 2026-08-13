import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Project,
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { superjson } from '@startuphafen/utility';
import { fixSequences } from '@startuphafen/utility-server';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { TRPCError } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'node:http';
import { migrateDatabase } from '../../assets-loader';
import { ConfigSchema } from '../../config';
import { buildEricRouter } from './eric-router';

jest.setTimeout(60_000);

const postgres = new DockerizedPostgres();

const baseUser: ShUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  cellPhoneNumber: '0000000000',
  phoneNumber: '0000000001',
  street: 'Some Street',
  postalCode: '12345',
  city: 'Berlin',
  inboxReference: '',
  country: 'Germany',
  dateOfBirth: '1990-01-01',
  academicTitle: null,
  title: null,
  name: null,
  roles: ['bundID-high'],
  createdAt: new Date(),
};

const otherUser: ShUser = {
  ...baseUser,
  id: 'user-2',
  email: 'john@example.com',
  firstName: 'John',
};

const ownProject: Project = {
  createdAt: new Date(),
  id: 100,
  name: 'Own Project',
  catalogueId: 'eun',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: baseUser.id,
};

const foreignProject: Project = {
  createdAt: new Date(),
  id: 101,
  name: 'Foreign Project',
  catalogueId: 'eun',
  gwSent: false,
  stSent: false,
  lastPosition: 0,
  progress: 0,
  userId: otherUser.id,
};

const baseConfig = ConfigSchema.parse({
  express: {
    host: '127.0.0.1',
    port: 5000,
  },
  knex: {
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      port: 5432,
      user: 'app',
      database: 'app',
      password: 'app',
    },
  },
  mail: {
    host: 'maildev',
    port: 1025,
    user: 'sh',
    password: 'sh',
    hwkRecipient: 'hwk@example.com',
    supportCC: 'support@example.com',
    supportRecipient: 'supportRecipient@example.com',
    feedbackRecipient: 'feedback@placeholder.invalid',
  },
  allowedOrigins: [],
  keycloak: {
    jwksUri:
      'http://localhost:8080/realms/startuphafen/protocol/openid-connect/certs',
    host: 'http://localhost:8080',
    user: 'admin',
    password: 'admin',
    realm: 'startuphafen',
    clientId: 'startuphafen_app',
  },
  matchingStrapi: {
    url: 'https://example.com',
  },
  watermarkConfig: {
    text: '',
  },
  eric: {},
  strapi: {},
  ozg: {},
});

const createCaller = (userId: string, trxFactory: TransactionFactory) => {
  return buildEricRouter(baseConfig).createCaller({
    trxFactory,
    token: {
      sub: userId,
      realm_access: {
        roles: ['bundID-high'],
      },
    },
  });
};

const createTrxFactory = (): TransactionFactory => {
  return async (work, readOnly) => {
    return await postgres.knex.transaction(async (trx) => await work(trx), {
      isolationLevel: 'serializable',
      readOnly,
    });
  };
};

async function startTestServer(userId: string): Promise<{
  close: () => Promise<void>;
  url: string;
}> {
  const app = express();
  app.use(express.json());
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: buildEricRouter(baseConfig),
      createContext: async () => ({
        trxFactory: createTrxFactory(),
        token: {
          sub: userId,
          realm_access: {
            roles: ['bundID-high'],
          },
        },
      }),
    })
  );

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/trpc`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error != null) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

describe('EricRouter', () => {
  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await migrateDatabase(postgres.knex);

    await postgres
      .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
      .insert([baseUser, otherUser]);

    await postgres
      .knex<Project>(STARTUPHAFENBACKEND_TABLES.PROJECT)
      .insert([ownProject, foreignProject]);

    await fixSequences(postgres.knex);
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('rejects SQL injection payloads for projectId on the real HTTP endpoint', async () => {
    const server = await startTestServer(baseUser.id);
    const client = createTRPCProxyClient<any>({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: server.url,
        }),
      ],
    }) as any;

    try {
      await expect(
        client.xmlPost.query({
          projectId: '1 OR 1=1 --',
          catalogueId: 'eun',
          bufaNr: 12345,
        })
      ).rejects.toMatchObject({
        data: expect.objectContaining({
          code: 'BAD_REQUEST',
        }),
        shape: expect.objectContaining({
          message: expect.stringContaining('number'),
        }),
      });
    } finally {
      await server.close();
    }
  });

  it('does not allow access to another users project with a numeric id', async () => {
    const caller = createCaller(baseUser.id, createTrxFactory());

    await expect(
      caller.xmlPost({
        projectId: foreignProject.id,
        catalogueId: 'eun',
        bufaNr: 12345,
      })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'User is not allowed to access this project',
    } satisfies Partial<TRPCError>);
  });
});
