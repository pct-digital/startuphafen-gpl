import { trpcBuilder } from '@startuphafen/trpc-root';
import { createTRPCStoreLimiter } from '@trpc-limiter/memory';
import { TRPCError } from '@trpc/server';
import type { ServerConfig } from '../../config';

export type RateLimiter = ReturnType<
  typeof createTRPCStoreLimiter<typeof trpcBuilder>
>;

const noopLimiter = (async (opts: { next: () => Promise<unknown> }) =>
  opts.next()) as RateLimiter;

function getRetryAfterLabel(retryAfterSeconds: number) {
  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds} Sekunden`;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
}

function getRetryAfterMessage(retryAfterSeconds: number) {
  return `Kurze Pause! Sie haben Ihr Nutzungslimit erreicht. In ${getRetryAfterLabel(
    retryAfterSeconds
  )} geht es weiter.`;
}

export const createRateLimiter = (
  config: ServerConfig['rateLimit']['upload'],
  name = 'default'
): RateLimiter => {
  if (!config.enabled || config.max <= 0) {
    return noopLimiter;
  }

  return createTRPCStoreLimiter<typeof trpcBuilder>({
    windowMs: config.windowMs,
    max: config.max,
    fingerprint: async (ctx) => ctx.token?.sub ?? 'anon',
    message: getRetryAfterMessage,
    onLimit: (retryAfterSeconds, ctx, fingerprint) => {
      console.warn(`[RateLimit ${name}] user throttled`, {
        code: 429,
        userId: ctx.token?.sub ?? 'anon',
        fingerprint,
        retryAfterSeconds,
      });
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: getRetryAfterMessage(retryAfterSeconds),
      });
    },
  });
};
