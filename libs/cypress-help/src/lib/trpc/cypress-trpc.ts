import { superjson } from '@startuphafen/utility';
import { AnyRouter } from '@trpc/server';

import { DecoratedProcedureRecord } from '@startuphafen/trpc-root';
import { httpLink, loggerLink } from '@trpc/client';

interface ProxyCallbackOptions {
  path: string[];
  args: unknown[];
}
type ProxyCallback = (opts: ProxyCallbackOptions) => unknown;

export function createRecursiveProxy(callback: ProxyCallback, path: string[]) {
  const proxy: unknown = new Proxy(
    () => {
      // dummy no-op function since we don't have any
      // client-side target we want to remap to
    },
    {
      get(_obj, key) {
        if (typeof key !== 'string') return undefined;
        // Recursively compose the full path until a function is invoked
        return createRecursiveProxy(callback, [...path, key]);
      },
      apply(_1, _2, args) {
        // Call the callback function with the entire path we
        // recursively created and forward the arguments
        return callback({
          path,
          args,
        });
      },
    }
  );
  return proxy;
}

export const followThePathOfAObject = (func: any, path: string[]) => {
  for (const p of path) {
    if (func != null) {
      func = func[p];
    }
  }
  return func;
};

export type TrpcClientFor<TRouter extends AnyRouter> = DecoratedProcedureRecord<
  TRouter['_def']['record']
>;

export const createTinyRPCClient = <TRouter extends AnyRouter>(
  fetchVersion: DecoratedProcedureRecord<TRouter['_def']['record']>
) =>
  createRecursiveProxy((opts) => {
    const [input] = opts.args;
    return cy.wrap(null).then(async () => {
      return new Cypress.Promise(async (resolve, reject) => {
        try {
          const func = followThePathOfAObject(fetchVersion, opts.path);
          const data = await func(input);
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    });
  }, []) as TrpcClientFor<TRouter>;

export function buildBaseTrpcConfig(url: string) {
  return {
    transformer: superjson,
    links: [
      loggerLink({
        enabled: (opts) =>
          opts.direction === 'down' && opts.result instanceof Error,
      }),
      httpLink({
        url,
      }),
    ],
  };
}
