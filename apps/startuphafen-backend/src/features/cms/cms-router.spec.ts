import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  ShUser,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { TRPCError } from '@trpc/server';
import { fixSequences } from '@startuphafen/utility-server';
import { migrateDatabase } from '../../assets-loader';
import { ConfigSchema } from '../../config';
import { buildCMSRouter } from './cms-router';
import { CMSTool } from './cms-tool';

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
  roles: ['login'],
  createdAt: new Date(),
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
  strapi: {
    host: 'https://strapi.example.com/api',
    token: 'token',
  },
  ozg: {},
});

const createCaller = () => {
  const trxFactory: TransactionFactory = async (work, readOnly) => {
    return postgres.knex.transaction(async (trx) => work(trx), {
      isolationLevel: 'serializable',
      readOnly,
    });
  };

  return buildCMSRouter(baseConfig).createCaller({
    trxFactory,
    token: {
      sub: 'user-1',
      realm_access: {
        roles: ['login'],
      },
    },
  });
};

describe('CMSRouter', () => {
  let getContentListSpy: jest.SpiedFunction<CMSTool['getContentList']>;
  let searchArticleSpy: jest.SpiedFunction<CMSTool['searchArticle']>;

  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getContentListSpy = jest.spyOn(CMSTool.prototype, 'getContentList');
    searchArticleSpy = jest.spyOn(CMSTool.prototype, 'searchArticle');

    return postgres.clearDatabase().then(async () => {
      await migrateDatabase(postgres.knex);
      await postgres
        .knex<ShUser>(STARTUPHAFENBACKEND_TABLES.SHUSER)
        .insert(baseUser);
      await fixSequences(postgres.knex);
    });
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('rejects arbitrary content names for getFAQItemList before calling Strapi', async () => {
    const caller = createCaller();
    const input = JSON.parse('{"name":"contacts"}');

    await expect(
      caller.getFAQItemList(input)
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      cause: expect.any(Error),
    } satisfies Partial<TRPCError>);

    expect(getContentListSpy).not.toHaveBeenCalled();
  });

  it('rejects path traversal attempts for getArtikelList before calling Strapi', async () => {
    const caller = createCaller();
    const input = JSON.parse('{"name":"../admin/users"}');

    await expect(
      caller.getArtikelList(input)
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      cause: expect.any(Error),
    } satisfies Partial<TRPCError>);

    expect(getContentListSpy).not.toHaveBeenCalled();
  });

  it('rejects SSRF-style absolute URLs for getArtikelList before calling Strapi', async () => {
    const caller = createCaller();
    const input = JSON.parse(
      '{"name":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}'
    );

    await expect(
      caller.getArtikelList(input)
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      cause: expect.any(Error),
    } satisfies Partial<TRPCError>);

    expect(getContentListSpy).not.toHaveBeenCalled();
  });

  it('allows the expected article content type for searchArticles', async () => {
    searchArticleSpy.mockResolvedValue([]);

    const caller = createCaller();

    await expect(
      caller.searchArticles({
        name: 'test-artikels',
        searchString: 'startup',
      })
    ).resolves.toEqual([]);

    expect(searchArticleSpy).toHaveBeenCalledTimes(1);
    expect(searchArticleSpy).toHaveBeenCalledWith(
      'test-artikels',
      'startup'
    );
  });
});
