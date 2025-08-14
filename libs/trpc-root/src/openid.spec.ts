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

    beforeEach(() => {
      nowTime = 5_000;
      keyGetter.mockClear();
      keyMap[
        'P4YPUFOUpfTE7bWe3KuWBKOyh76Chl2k4T0Ki5hzKxw'
      ] = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtCwfwaHEOuCPa+R6fb1M
TJSnQsg5KLJoojdm5wvWjgln+CBQplIF+a4F+CVRDeUrdwAcnG1XRP8k2d/xH6I6
uVHPvIJYIsBSPRFsePXb5WZka+tNB0o7oojCzN07oiduwqQAQpwdyu5C7dEbaSvJ
Y2l/S7gfE80OvBrdGp7NcgIPZs9Zew1w1SK2CPMgRbxbCf/8uCZHFuYsWVfe7xIu
ZgpSN0YZmwvMdpB1qjc8++6ZDjILo2elNqKLmgJ7rHFHrQI54LPu9wQvgQqNMfMG
LvWWw3QeY/5/ZNg+wvSjDVKh9QabvCRwUeUimcEcwOjTsKde+vkq7tXec0TtEXma
xQIDAQAB
-----END PUBLIC KEY-----`;
    });

    it('validates a jwt', async () => {
      const jwt =
        'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJQNFlQVUZPVXBmVEU3YldlM0t1V0JLT3loNzZDaGwyazRUMEtpNWh6S3h3In0.eyJleHAiOjE3MTI1MDI0MTksImlhdCI6MTcxMjUwMjExOSwiYXV0aF90aW1lIjoxNzEyNTAyMTE5LCJqdGkiOiI3NDEzMzBmZi1kNjEwLTRiNjUtYThlOS04NzM3ZWIxMTRlZWIiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQwMDAva2MvcmVhbG1zL3BvcnRhbCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJmODE2NzcyYS00MDIyLTRmNzUtODJiNi05YmQxYTcwZjEyMmEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwb3J0YWwiLCJub25jZSI6ImZhYzJkZGJkLTEzZmQtNGYyOC04NDgxLWI1NTE0MzVhN2QwOSIsInNlc3Npb25fc3RhdGUiOiJmYWQ4OTMzYi04ZjRlLTQyOWYtOWIwOC0wNTU0MTEzYTQwYWQiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMCJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidXNlciJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiXX19LCJzY29wZSI6Im9wZW5pZCBlbWFpbCBwcm9maWxlIiwic2lkIjoiZmFkODkzM2ItOGY0ZS00MjlmLTliMDgtMDU1NDExM2E0MGFkIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJuYW1lIjoiQWxpY2UgTGlkZGVsIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWxpY2UiLCJnaXZlbl9uYW1lIjoiQWxpY2UiLCJmYW1pbHlfbmFtZSI6IkxpZGRlbCIsImVtYWlsIjoiYWxpY2VAa2V5Y2xvYWsub3JnIn0.Ok4WxJtYf8dx1edCsBWDdlbum1wiaM8TgczUgGQKTwAGEL-hhwrkMMR3UWoimsO814uxRkPqjMcN2doQ9mzqCI3S1Vtf7j_nHciEKV6yjv4cN_fzCw-y37qO7eZZoHYYIhkHQwH-xOkvVwOO5XI9OJ3XXhHmkyQe8BkFK9vV-4H2xXYxljRK5NBEUw4JxTVwjpXDQAz7CERthAoLm-lw1CZtLfbh5OGKQZsqSqhoX-QDUcU0XwDlfxQf0Qhc7bDQlDpI02QC5B3XGcKTyg6DnDIeDuoDZ-DhlQZ1SeIrMkDET-7VUIqO2UrJ9K8NVKevwiLcsbg2k2Vra45KsFG04A';

      const func = buildCachedValidateJwtFunction(
        'jwks',
        timer,
        keyGetter,
        () => 1712502151
      );

      await expect(func(jwt)).resolves.toEqual({
        exp: 1712502419,
        iat: 1712502119,
        auth_time: 1712502119,
        jti: '741330ff-d610-4b65-a8e9-8737eb114eeb',
        iss: 'http://localhost:4000/kc/realms/portal',
        aud: 'account',
        sub: 'f816772a-4022-4f75-82b6-9bd1a70f122a',
        typ: 'Bearer',
        azp: 'portal',
        nonce: 'fac2ddbd-13fd-4f28-8481-b551435a7d09',
        session_state: 'fad8933b-8f4e-429f-9b08-0554113a40ad',
        acr: '1',
        'allowed-origins': ['http://localhost:4000'],
        realm_access: { roles: ['user'] },
        resource_access: { account: { roles: ['manage-account'] } },
        scope: 'openid email profile',
        sid: 'fad8933b-8f4e-429f-9b08-0554113a40ad',
        email_verified: false,
        name: 'Alice Liddel',
        preferred_username: 'alice',
        given_name: 'Alice',
        family_name: 'Liddel',
        email: 'alice@keycloak.org',
      });
    });

    it('rejects a forged token with false admin role', async () => {
      const jwt =
        'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJQNFlQVUZPVXBmVEU3YldlM0t1V0JLT3loNzZDaGwyazRUMEtpNWh6S3h3In0.eyJleHAiOjE3MTI1MDI0MTksImlhdCI6MTcxMjUwMjExOSwiYXV0aF90aW1lIjoxNzEyNTAyMTE5LCJqdGkiOiI3NDEzMzBmZi1kNjEwLTRiNjUtYThlOS04NzM3ZWIxMTRlZWIiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQwMDAva2MvcmVhbG1zL3BvcnRhbCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJmODE2NzcyYS00MDIyLTRmNzUtODJiNi05YmQxYTcwZjEyMmEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwb3J0YWwiLCJub25jZSI6ImZhYzJkZGJkLTEzZmQtNGYyOC04NDgxLWI1NTE0MzVhN2QwOSIsInNlc3Npb25fc3RhdGUiOiJmYWQ4OTMzYi04ZjRlLTQyOWYtOWIwOC0wNTU0MTEzYTQwYWQiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMCJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidXNlciIsICJhZG1pbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiXX19LCJzY29wZSI6Im9wZW5pZCBlbWFpbCBwcm9maWxlIiwic2lkIjoiZmFkODkzM2ItOGY0ZS00MjlmLTliMDgtMDU1NDExM2E0MGFkIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJuYW1lIjoiQWxpY2UgTGlkZGVsIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWxpY2UiLCJnaXZlbl9uYW1lIjoiQWxpY2UiLCJmYW1pbHlfbmFtZSI6IkxpZGRlbCIsImVtYWlsIjoiYWxpY2VAa2V5Y2xvYWsub3JnIn0.Ok4WxJtYf8dx1edCsBWDdlbum1wiaM8TgczUgGQKTwAGEL-hhwrkMMR3UWoimsO814uxRkPqjMcN2doQ9mzqCI3S1Vtf7j_nHciEKV6yjv4cN_fzCw-y37qO7eZZoHYYIhkHQwH-xOkvVwOO5XI9OJ3XXhHmkyQe8BkFK9vV-4H2xXYxljRK5NBEUw4JxTVwjpXDQAz7CERthAoLm-lw1CZtLfbh5OGKQZsqSqhoX-QDUcU0XwDlfxQf0Qhc7bDQlDpI02QC5B3XGcKTyg6DnDIeDuoDZ-DhlQZ1SeIrMkDET-7VUIqO2UrJ9K8NVKevwiLcsbg2k2Vra45KsFG04A';

      const func = buildCachedValidateJwtFunction(
        'jwks',
        timer,
        keyGetter,
        () => 1712502151
      );

      await expect(func(jwt)).rejects.toThrow('invalid signature');
    });

    it('rejects a token for a different public key', async () => {
      // different public key
      keyMap[
        'P4YPUFOUpfTE7bWe3KuWBKOyh76Chl2k4T0Ki5hzKxw'
      ] = `-----BEGIN PUBLIC KEY-----
MIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgFe9DIniA/czqIRujiNkOiSt4VUG
Q8fU63pyJIFZsVr4IvjttDV91GujGdGMfPDLYrSGZlIphdC/iHbhT9iI7KRUaoI6
S3SyG3O9ZPN0X/cOiObXSbvgZrseBcdEhuky2R4m10xMTBmflEbLU3wG76BKevEg
2kTcN33ThXbR/kwNAgMBAAE=
-----END PUBLIC KEY-----`;

      const jwt =
        'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJQNFlQVUZPVXBmVEU3YldlM0t1V0JLT3loNzZDaGwyazRUMEtpNWh6S3h3In0.eyJleHAiOjE3MTI1MDI0MTksImlhdCI6MTcxMjUwMjExOSwiYXV0aF90aW1lIjoxNzEyNTAyMTE5LCJqdGkiOiI3NDEzMzBmZi1kNjEwLTRiNjUtYThlOS04NzM3ZWIxMTRlZWIiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQwMDAva2MvcmVhbG1zL3BvcnRhbCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJmODE2NzcyYS00MDIyLTRmNzUtODJiNi05YmQxYTcwZjEyMmEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwb3J0YWwiLCJub25jZSI6ImZhYzJkZGJkLTEzZmQtNGYyOC04NDgxLWI1NTE0MzVhN2QwOSIsInNlc3Npb25fc3RhdGUiOiJmYWQ4OTMzYi04ZjRlLTQyOWYtOWIwOC0wNTU0MTEzYTQwYWQiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMCJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidXNlciJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiXX19LCJzY29wZSI6Im9wZW5pZCBlbWFpbCBwcm9maWxlIiwic2lkIjoiZmFkODkzM2ItOGY0ZS00MjlmLTliMDgtMDU1NDExM2E0MGFkIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJuYW1lIjoiQWxpY2UgTGlkZGVsIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWxpY2UiLCJnaXZlbl9uYW1lIjoiQWxpY2UiLCJmYW1pbHlfbmFtZSI6IkxpZGRlbCIsImVtYWlsIjoiYWxpY2VAa2V5Y2xvYWsub3JnIn0.Ok4WxJtYf8dx1edCsBWDdlbum1wiaM8TgczUgGQKTwAGEL-hhwrkMMR3UWoimsO814uxRkPqjMcN2doQ9mzqCI3S1Vtf7j_nHciEKV6yjv4cN_fzCw-y37qO7eZZoHYYIhkHQwH-xOkvVwOO5XI9OJ3XXhHmkyQe8BkFK9vV-4H2xXYxljRK5NBEUw4JxTVwjpXDQAz7CERthAoLm-lw1CZtLfbh5OGKQZsqSqhoX-QDUcU0XwDlfxQf0Qhc7bDQlDpI02QC5B3XGcKTyg6DnDIeDuoDZ-DhlQZ1SeIrMkDET-7VUIqO2UrJ9K8NVKevwiLcsbg2k2Vra45KsFG04A';

      const func = buildCachedValidateJwtFunction(
        'jwks',
        timer,
        keyGetter,
        () => 1712502151
      );

      await expect(func(jwt)).rejects.toThrow('invalid signature');
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

    beforeEach(() => {
      nowTime = 5_000;
      keyGetter.mockClear();
      keyMap[
        'P4YPUFOUpfTE7bWe3KuWBKOyh76Chl2k4T0Ki5hzKxw'
      ] = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtCwfwaHEOuCPa+R6fb1M
TJSnQsg5KLJoojdm5wvWjgln+CBQplIF+a4F+CVRDeUrdwAcnG1XRP8k2d/xH6I6
uVHPvIJYIsBSPRFsePXb5WZka+tNB0o7oojCzN07oiduwqQAQpwdyu5C7dEbaSvJ
Y2l/S7gfE80OvBrdGp7NcgIPZs9Zew1w1SK2CPMgRbxbCf/8uCZHFuYsWVfe7xIu
ZgpSN0YZmwvMdpB1qjc8++6ZDjILo2elNqKLmgJ7rHFHrQI54LPu9wQvgQqNMfMG
LvWWw3QeY/5/ZNg+wvSjDVKh9QabvCRwUeUimcEcwOjTsKde+vkq7tXec0TtEXma
xQIDAQAB
-----END PUBLIC KEY-----`;
    });

    it('parses a valid bearer token', async () => {
      const reqFunc = buildTokenInformationForRequestFunction(
        'jwks',
        timer,
        keyGetter,
        () => 1712502151
      );

      await expect(
        reqFunc({
          headers: {
            authorization:
              'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJQNFlQVUZPVXBmVEU3YldlM0t1V0JLT3loNzZDaGwyazRUMEtpNWh6S3h3In0.eyJleHAiOjE3MTI1MDI0MTksImlhdCI6MTcxMjUwMjExOSwiYXV0aF90aW1lIjoxNzEyNTAyMTE5LCJqdGkiOiI3NDEzMzBmZi1kNjEwLTRiNjUtYThlOS04NzM3ZWIxMTRlZWIiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQwMDAva2MvcmVhbG1zL3BvcnRhbCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJmODE2NzcyYS00MDIyLTRmNzUtODJiNi05YmQxYTcwZjEyMmEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwb3J0YWwiLCJub25jZSI6ImZhYzJkZGJkLTEzZmQtNGYyOC04NDgxLWI1NTE0MzVhN2QwOSIsInNlc3Npb25fc3RhdGUiOiJmYWQ4OTMzYi04ZjRlLTQyOWYtOWIwOC0wNTU0MTEzYTQwYWQiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMCJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidXNlciJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiXX19LCJzY29wZSI6Im9wZW5pZCBlbWFpbCBwcm9maWxlIiwic2lkIjoiZmFkODkzM2ItOGY0ZS00MjlmLTliMDgtMDU1NDExM2E0MGFkIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJuYW1lIjoiQWxpY2UgTGlkZGVsIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWxpY2UiLCJnaXZlbl9uYW1lIjoiQWxpY2UiLCJmYW1pbHlfbmFtZSI6IkxpZGRlbCIsImVtYWlsIjoiYWxpY2VAa2V5Y2xvYWsub3JnIn0.Ok4WxJtYf8dx1edCsBWDdlbum1wiaM8TgczUgGQKTwAGEL-hhwrkMMR3UWoimsO814uxRkPqjMcN2doQ9mzqCI3S1Vtf7j_nHciEKV6yjv4cN_fzCw-y37qO7eZZoHYYIhkHQwH-xOkvVwOO5XI9OJ3XXhHmkyQe8BkFK9vV-4H2xXYxljRK5NBEUw4JxTVwjpXDQAz7CERthAoLm-lw1CZtLfbh5OGKQZsqSqhoX-QDUcU0XwDlfxQf0Qhc7bDQlDpI02QC5B3XGcKTyg6DnDIeDuoDZ-DhlQZ1SeIrMkDET-7VUIqO2UrJ9K8NVKevwiLcsbg2k2Vra45KsFG04A',
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
        () => 1712502151
      );

      const result = await reqFunc({
        headers: {
          authorization:
            'Bearer eyJhbGciOiJSUzIXNiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJQNFlQVUZPVXBmVEU3YldlM0t1V0JLT3loNzZDaGwyazRUMEtpNWh6S3h3In0.eyJleHAiOjE3MTI1MDI0MTksImlhdCI6MTcxMjUwMjExOSwiYXV0aF90aW1lIjoxNzEyNTAyMTE5LCJqdGkiOiI3NDEzMzBmZi1kNjEwLTRiNjUtYThlOS04NzM3ZWIxMTRlZWIiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQwMDAva2MvcmVhbG1zL3BvcnRhbCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJmODE2NzcyYS00MDIyLTRmNzUtODJiNi05YmQxYTcwZjEyMmEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJwb3J0YWwiLCJub25jZSI6ImZhYzJkZGJkLTEzZmQtNGYyOC04NDgxLWI1NTE0MzVhN2QwOSIsInNlc3Npb25fc3RhdGUiOiJmYWQ4OTMzYi04ZjRlLTQyOWYtOWIwOC0wNTU0MTEzYTQwYWQiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMCJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidXNlciJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiXX19LCJzY29wZSI6Im9wZW5pZCBlbWFpbCBwcm9maWxlIiwic2lkIjoiZmFkODkzM2ItOGY0ZS00MjlmLTliMDgtMDU1NDExM2E0MGFkIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJuYW1lIjoiQWxpY2UgTGlkZGVsIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWxpY2UiLCJnaXZlbl9uYW1lIjoiQWxpY2UiLCJmYW1pbHlfbmFtZSI6IkxpZGRlbCIsImVtYWlsIjoiYWxpY2VAa2V5Y2xvYWsub3JnIn0.Ok4WxJtYf8dx1edCsBWDdlbum1wiaM8TgczUgGQKTwAGEL-hhwrkMMR3UWoimsO814uxRkPqjMcN2doQ9mzqCI3S1Vtf7j_nHciEKV6yjv4cN_fzCw-y37qO7eZZoHYYIhkHQwH-xOkvVwOO5XI9OJ3XXhHmkyQe8BkFK9vV-4H2xXYxljRK5NBEUw4JxTVwjpXDQAz7CERthAoLm-lw1CZtLfbh5OGKQZsqSqhoX-QDUcU0XwDlfxQf0Qhc7bDQlDpI02QC5B3XGcKTyg6DnDIeDuoDZ-DhlQZ1SeIrMkDET-7VUIqO2UrJ9K8NVKevwiLcsbg2k2Vra45KsFG04A',
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
