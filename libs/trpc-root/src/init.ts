import { superjson } from '@startuphafen/utility';
import { initTRPC } from '@trpc/server';
import { Meta, StandardRequestContext } from './context';

export const trpcBuilder = initTRPC
  .context<StandardRequestContext>()
  .meta<Meta>()
  .create({
    isServer: true,
    transformer: superjson,
  });
