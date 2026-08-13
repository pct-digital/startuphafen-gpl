import { TransactionFactory } from '@startuphafen/serialized-transaction';
import { KeycloakToken } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { createRateLimiter, RateLimiter } from './rate-limiter';

const buildConfig = (overrides?: {
  enabled?: boolean;
  max?: number;
  windowMs?: number;
}) => ({
  enabled: true,
  max: 1,
  windowMs: 60_000,
  ...overrides,
});

const buildToken = (sub: string): KeycloakToken =>
  ({
    sub,
    realm_access: {
      roles: ['login'],
    },
  } as KeycloakToken);

const trxFactory: TransactionFactory = async () => {
  throw new Error('TransactionFactory should not be called in rate limiter tests.');
};

const buildMiddlewareOptions = (
  userId: string,
  next = jest.fn(async () => ({ ok: true, data: 'ok' }))
) =>
  ({
    ctx: {
      trxFactory,
      featureFlags: undefined,
      token: buildToken(userId),
    },
    type: 'query' as const,
    path: 'Test.invoke',
    input: undefined,
    getRawInput: async () => undefined,
    meta: undefined,
    signal: undefined,
    batchIndex: 0,
    next,
  } as unknown as Parameters<RateLimiter>[0]);

describe('createRateLimiter', () => {
  it('allows the first request and blocks the second request for the same user', async () => {
    const limiter = createRateLimiter(buildConfig());
    const next = jest.fn(async () => ({ ok: true, data: 'ok' }));
    const opts = buildMiddlewareOptions('user-1', next);

    await expect(limiter(opts)).resolves.toMatchObject({ ok: true, data: 'ok' });
    await expect(limiter(opts)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to noop when disabled in config', async () => {
    const limiter = createRateLimiter(buildConfig({ enabled: false }));
    const next = jest.fn(async () => ({ ok: true, data: 'ok' }));
    const opts = buildMiddlewareOptions('user-2', next);

    await expect(limiter(opts)).resolves.toMatchObject({ ok: true, data: 'ok' });
    await expect(limiter(opts)).resolves.toMatchObject({ ok: true, data: 'ok' });
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('reports retry-after in seconds for short windows', async () => {
    const limiter = createRateLimiter(buildConfig({ max: 1, windowMs: 20_000 }));
    const opts = buildMiddlewareOptions('user-3');

    await limiter(opts);

    await expect(limiter(opts)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: expect.stringMatching(/In \d+ Sekunden/),
    });
  });

  it('throws a TRPCError on limit hit', async () => {
    const limiter = createRateLimiter(buildConfig());
    const opts = buildMiddlewareOptions('user-4');

    await limiter(opts);

    await expect(limiter(opts)).rejects.toBeInstanceOf(TRPCError);
  });
});
