import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  buildTimedCacheTimer,
  buildTokenInformationForRequestFunction,
} from './openid';

describe('openid security verification', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const privateKeyPem = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
  const publicKeyPem = publicKey.export({
    type: 'spki',
    format: 'pem',
  }) as string;

  const timer = buildTimedCacheTimer(
    10,
    () => 1_000,
    async () => undefined
  );

const keyGetter = jest.fn(async (_jwksUri: string, kid: string) => {
    if (kid !== 'kid-1') {
      throw new Error(`Unexpected kid ${kid}`);
    }

    return publicKeyPem;
  });

  beforeEach(() => {
    keyGetter.mockClear();
  });

  it('rejects a validly signed token when issuer and audience are arbitrary', async () => {
    const token = jwt.sign(
      {
        sub: 'attacker-user',
        realm_access: { roles: ['bundID-high'] },
        aud: 'other-service',
        iss: 'https://unrelated-issuer.example',
      },
      privateKeyPem,
      {
        algorithm: 'RS512',
        header: { alg: 'RS512', kid: 'kid-1', typ: 'JWT' },
        expiresIn: '1h',
      }
    );

    const readToken = buildTokenInformationForRequestFunction(
      'jwks',
      timer,
      keyGetter,
      () => Math.floor(Date.now() / 1000),
      {
        realm: 'startuphafen',
        clientId: 'startuphafen_app',
      }
    );

    await expect(
      readToken({
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any)
    ).resolves.toBeUndefined();
  });

  it('does not accept an HS256 algorithm confusion payload', async () => {
    const forgedToken = jwt.sign(
      {
        sub: 'attacker-user',
        realm_access: { roles: ['bundID-high'] },
      },
      publicKeyPem,
      {
        algorithm: 'HS256',
        header: { alg: 'HS256', kid: 'kid-1', typ: 'JWT' },
        expiresIn: '1h',
      }
    );

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const readToken = buildTokenInformationForRequestFunction(
      'jwks',
      timer,
      keyGetter,
      () => Math.floor(Date.now() / 1000),
      {
        realm: 'startuphafen',
        clientId: 'startuphafen_app',
      }
    );

    await expect(
      readToken({
        headers: {
          authorization: `Bearer ${forgedToken}`,
        },
      } as any)
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching('Failed to validate a token'),
      expect.anything()
    );
  });
});
