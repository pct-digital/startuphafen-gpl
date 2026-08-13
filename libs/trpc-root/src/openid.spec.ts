import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import {
  buildCachedValidateJwtFunction,
  buildTimedCacheTimer,
  buildTokenInformationForRequestFunction,
  getCachedKeyFactory,
} from './openid';

describe('the openid token validator', () => {
  it('provides a timed cache timer which will return check true for a few seconds as configured', async () => {
    let nowTime = 5_000;

    const timer = buildTimedCacheTimer(
      3,
      () => nowTime,
      async (x: number) => {
        nowTime += x * 1000;
      }
    );

    expect(timer.check()).toBeTruthy();

    nowTime = 10_000;
    expect(timer.check()).toBeFalsy();

    timer.set();
    expect(timer.check()).toBeTruthy();
    nowTime = 11_000;
    expect(timer.check()).toBeTruthy();

    nowTime = 13_000;
    expect(timer.check()).toBeTruthy();

    nowTime = 13_001;
    expect(timer.check()).toBeFalsy();

    await timer.wait();
    expect((nowTime = 18_000));
  });

  describe('the cached key factory', () => {
    let nowTime = 5_000;

    const timer = buildTimedCacheTimer(
      3,
      () => nowTime,
      async (x: number) => {
        nowTime += x * 1000;
      }
    );

    const keyMap: Record<string, string> = {
      '1': 'A',
      '2': 'B',
    };

    const keyGetter = jest.fn(async (jwksUri, kid) => {
      if (jwksUri !== 'jwks')
        throw new Error(
          'the test passed in jwks as a uri, why is it not set? got: ' + jwksUri
        );
      return keyMap[kid];
    });

    beforeEach(() => {
      keyGetter.mockClear();
      nowTime = 5_000;
    });

    it('gets a key from the jwksUri', async () => {
      const factory = getCachedKeyFactory('jwks', timer, keyGetter);
      const key = await factory('1');
      expect(key).toBe('A');
      expect(keyGetter).toHaveBeenCalledTimes(1);
    });

    it('uses the cache to not query for the public key too often', async () => {
      const factory = getCachedKeyFactory('jwks', timer, keyGetter);
      const key1 = await factory('1');
      expect(key1).toBe('A');
      const key2 = await factory('1');
      expect(key2).toBe('A');
      expect(keyGetter).toHaveBeenCalledTimes(1);
    });

    it('invalidates the cache after some time has passed', async () => {
      const factory = getCachedKeyFactory('jwks', timer, keyGetter);

      const key1 = await factory('1');
      expect(key1).toBe('A');

      expect(keyGetter).toHaveBeenCalledTimes(1);

      nowTime += 5_000;

      const key2 = await factory('1');
      expect(key2).toBe('A');

      expect(keyGetter).toHaveBeenCalledTimes(2);

      const key3 = await factory('1');
      expect(key3).toBe('A');

      expect(keyGetter).toHaveBeenCalledTimes(2);
    });

    it('does not query twice on concurrent requests', async () => {
      const factory = getCachedKeyFactory('jwks', timer, keyGetter);
      const keyPromise1 = factory('1');
      const keyPromise2 = factory('1');

      const keys = await Promise.all([keyPromise1, keyPromise2]);

      expect(keys).toEqual(['A', 'A']);
      expect(keyGetter).toHaveBeenCalledTimes(1);
    });
  });

  describe('the cached validate jwt function', () => {
    const keyMap: Record<string, string> = {};

    let nowTime = 5_000;

    const timer = buildTimedCacheTimer(
      3,
      () => nowTime,
      async (x: number) => {
        nowTime += x * 1000;
      }
    );

    const keyGetter = jest.fn(async (jwksUri, kid) => {
      if (jwksUri !== 'jwks')
        throw new Error(
          'the test passed in jwks as a uri, why is it not set? got: ' + jwksUri
        );
      return keyMap[kid];
    });

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

    const validPayload = {
      sub: 'f816772a-4022-4f75-82b6-9bd1a70f122a',
      typ: 'Bearer',
      iss: 'http://localhost:4000/kc/realms/startuphafen',
      aud: 'account',
      azp: 'startuphafen',
      realm_access: { roles: ['user'] },
      name: 'Alice Liddel',
      preferred_username: 'alice',
      given_name: 'Alice',
      family_name: 'Liddel',
      email: 'alice@keycloak.org',
      email_verified: false,
    };

    function signToken(
      payload: Record<string, unknown>,
      key: string,
      kid = 'kid-1'
    ) {
      return jwt.sign(payload, key, {
        algorithm: 'RS512',
        header: { alg: 'RS512', kid, typ: 'JWT' },
        expiresIn: '1h',
      });
    }

    beforeEach(() => {
      nowTime = 5_000;
      keyGetter.mockClear();
      keyMap['kid-1'] = publicKeyPem;
    });

    it('validates a jwt', async () => {
      const token = signToken(validPayload, privateKeyPem);

      const func = buildCachedValidateJwtFunction(
        'jwks',
        timer,
        keyGetter,
        () => Math.floor(Date.now() / 1000)
      );

      await expect(func(token)).resolves.toEqual(
        expect.objectContaining({
          sub: 'f816772a-4022-4f75-82b6-9bd1a70f122a',
          typ: 'Bearer',
          name: 'Alice Liddel',
          email: 'alice@keycloak.org',
        })
      );
    });

    it('rejects a forged token with false admin role', async () => {
      const forgedPayload = {
        ...validPayload,
        realm_access: { roles: ['user', 'admin'] },
      };

      // Sign with a different key to simulate forgery
      const { privateKey: otherKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const otherKeyPem = otherKey.export({
        type: 'pkcs8',
        format: 'pem',
      }) as string;

      const token = signToken(forgedPayload, otherKeyPem);

      const func = buildCachedValidateJwtFunction(
        'jwks',
        timer,
        keyGetter,
        () => Math.floor(Date.now() / 1000)
      );

      await expect(func(token)).rejects.toThrow('invalid signature');
    });

    it('rejects a token for a different public key', async () => {
      const { publicKey: otherPub } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      keyMap['kid-1'] = otherPub.export({
        type: 'spki',
        format: 'pem',
      }) as string;

      const token = signToken(validPayload, privateKeyPem);

      const func = buildCachedValidateJwtFunction(
        'jwks',
        timer,
        keyGetter,
        () => Math.floor(Date.now() / 1000)
      );

      await expect(func(token)).rejects.toThrow('invalid signature');
    });
  });

  describe('the token information for request function', () => {
    const keyMap: Record<string, string> = {};

    let nowTime = 5_000;

    const timer = buildTimedCacheTimer(
      3,
      () => nowTime,
      async (x: number) => {
        nowTime += x * 1000;
      }
    );

    const keyGetter = jest.fn(async (jwksUri, kid) => {
      if (jwksUri !== 'jwks')
        throw new Error(
          'the test passed in jwks as a uri, why is it not set? got: ' + jwksUri
        );
      return keyMap[kid];
    });

    const { privateKey: reqPrivateKey, publicKey: reqPublicKey } =
      generateKeyPairSync('rsa', { modulusLength: 2048 });
    const reqPrivateKeyPem = reqPrivateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;
    const reqPublicKeyPem = reqPublicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;

    beforeEach(() => {
      nowTime = 5_000;
      keyGetter.mockClear();
      keyMap['kid-1'] = reqPublicKeyPem;
    });

    it('parses a valid bearer token', async () => {
      const token = jwt.sign(
        {
          sub: 'f816772a-4022-4f75-82b6-9bd1a70f122a',
          typ: 'Bearer',
        },
        reqPrivateKeyPem,
        {
          algorithm: 'RS512',
          header: { alg: 'RS512', kid: 'kid-1', typ: 'JWT' },
          expiresIn: '1h',
        }
      );

      const reqFunc = buildTokenInformationForRequestFunction(
        'jwks',
        timer,
        keyGetter,
        () => Math.floor(Date.now() / 1000)
      );

      await expect(
        reqFunc({
          headers: {
            authorization: `Bearer ${token}`,
          },
        } as any)
      ).resolves.toEqual(
        expect.objectContaining({
          sub: 'f816772a-4022-4f75-82b6-9bd1a70f122a',
        })
      );
    });

    it('rejects an invalid token and returns undefined', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});

      const reqFunc = buildTokenInformationForRequestFunction(
        'jwks',
        timer,
        keyGetter,
        () => Math.floor(Date.now() / 1000)
      );

      const result = await reqFunc({
        headers: {
          authorization: 'Bearer eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6ImtpZC0xIn0.eyJzdWIiOiJ0ZXN0IiwidHlwIjoiQmVhcmVyIn0.invalid-signature',
        },
      } as any);

      expect(result).toBeUndefined();

      expect(log.mock.calls).toEqual([
        [
          expect.stringMatching('Failed to validate a token'),
          expect.anything(),
        ],
      ]);
    });
  });
});
