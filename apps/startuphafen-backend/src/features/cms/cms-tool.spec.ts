import axios from 'axios';
import { createServer, Server, ServerResponse } from 'http';
import { ConfigSchema } from '../../config';
import { CMSTool } from './cms-tool';

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

function respondWithJson(res: ServerResponse, payload: unknown) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getPort(server: Server) {
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('Test server port is unavailable');
  }

  return address.port;
}

function createAxiosCreateMock(baseUrl: string) {
  const realAxiosCreate = axios.create.bind(axios);

  return jest
    .spyOn(axios, 'create')
    .mockImplementation((config) => {
      if (config?.baseURL === 'https://openplzapi.org/de') {
        return realAxiosCreate({
          ...config,
          baseURL: `${baseUrl}/de`,
        });
      }

      return realAxiosCreate(config);
    });
}

describe('CMSTool', () => {
  let server: Server;
  let baseUrl: string;
  const requests: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      requests.push(url.pathname + url.search);
      if (url.pathname !== '/de/Localities') {
        respondWithJson(res, {
          data: [
            {
              requestPath: url.pathname + url.search,
            },
          ],
        });
        return;
      }

      const postalCode = url.searchParams.get('postalCode');
      if (postalCode === '24103') {
        respondWithJson(res, [
          {
            district: {
              name: 'Kiel',
            },
          },
        ]);
        return;
      }

      respondWithJson(res, []);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const port = getPort(server);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    requests.length = 0;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error != null) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it('returns the district name when OpenPLZ finds a locality', async () => {
    createAxiosCreateMock(baseUrl);
    const tool = new CMSTool(baseConfig);

    await expect(tool.getKreis('24103')).resolves.toBe('Kiel');
  });

  it('falls back to universal contacts when OpenPLZ returns no localities', async () => {
    createAxiosCreateMock(baseUrl);
    const tool = new CMSTool(baseConfig);

    await expect(tool.getKreis('12345')).resolves.toBe('Universal');
  });

  it('keeps getContentList requests on the configured Strapi host for URL-like names', async () => {
    const tool = new CMSTool({
      ...baseConfig,
      strapi: {
        host: `${baseUrl}/api`,
        token: 'token',
      },
    });

    const result = await tool.getContentList(
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/'
    );

    expect(result).toEqual([
      {
        requestPath:
          '/api/http://169.254.169.254/latest/meta-data/iam/security-credentials/?&populate=*',
      },
    ]);
    expect(requests).toEqual([
      '/api/http://169.254.169.254/latest/meta-data/iam/security-credentials/?&populate=*',
    ]);
  });

  it('treats getContacts parameter pollution as query data on the configured host, not a new destination', async () => {
    const tool = new CMSTool({
      ...baseConfig,
      strapi: {
        host: `${baseUrl}/api`,
        token: 'token',
      },
    });

    const result = await tool.getContacts('Universal&port=22');

    expect(result).toEqual([
      {
        requestPath:
          '/api/contacts?filters[kreis][$eq]=Universal&port=22&filters[kreis][$eq]=Universal&populate=*',
      },
    ]);
    expect(requests).toEqual([
      '/api/contacts?filters[kreis][$eq]=Universal&port=22&filters[kreis][$eq]=Universal&populate=*',
    ]);
  });
});
