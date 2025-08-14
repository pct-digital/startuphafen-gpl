import type {
  DecorateProcedure,
  DecoratedProcedureRecord,
} from '@startuphafen/trpc-root';
import type {
  AnyProcedure,
  AnyRouter,
  ProcedureRouterRecord,
} from '@trpc/server';

// based on explanation of the magic behind trpc here: https://trpc.io/blog/tinyrpc-client

export type PartialDecoratedProcedureRecord<
  TProcedures extends ProcedureRouterRecord
> = Partial<{
  [TKey in keyof TProcedures]: TProcedures[TKey] extends AnyRouter
    ? PartialDecoratedProcedureRecord<TProcedures[TKey]['_def']['record']>
    : TProcedures[TKey] extends AnyProcedure
    ? DecorateProcedure<TProcedures[TKey]>
    : never;
}>;

interface ProxyCallbackOptions {
  path: string[];
  args: unknown[];
}

type ProxyCallback = (opts: ProxyCallbackOptions) => unknown;

function createRecursiveProxy(callback: ProxyCallback, path: string[]) {
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

const followPath = (func: any, path: string[]) => {
  for (const p of path) {
    if (func != null) {
      func = func[p];
    }
  }
  return func;
};

/**
 * 
 * You need to do a import type for the AppRouter for this, like so:
 * 
 * // eslint-disable-next-line @nx/enforce-module-boundaries
   import type { AppRouter } from '../../../../../../server/src/app/router';
 * 
 * Then use like this:
 * 
 * spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Milestone: {
        readFiltered: {
          async query() {
            return [
              {
                id: 1,
                leistungsdatum: null,
                name: 'M1',
                number: 1,
                percentagePurchaseVolume: 10,
                projectId: 1,
              }
            ];
          },
        },
      },
    });

  You can also extend over an existing trpc client to only change the behavior of some functions.
  This is very useful in case you have some standard init code that sets some mock routes, but your tests
  wants those plus one more route.

  spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      Milestone: {
        readFiltered: {
          async query() {
            return [
              {
                id: 1,
                leistungsdatum: null,
                name: 'M1',
                number: 1,
                percentagePurchaseVolume: 10,
                projectId: 1,
              }
            ];
          },
        },
      },
    }, spectator.inject(TrpcService).client); // <- provide the existing client as a fallback
 * 
 */
export const createMockTrpcClient = <TRouter extends AnyRouter>(
  ...impls: PartialDecoratedProcedureRecord<TRouter['_def']['record']>[]
) =>
  createRecursiveProxy(async (opts) => {
    for (const impl of impls) {
      const func = followPath(impl, opts.path);
      if (func == null) {
        continue;
      }
      const [input] = opts.args;
      return await func(input);
    }

    throw new Error(
      'mock trpc client does not have function implemented: ' +
        opts.path.join('.')
    );
  }, []) as DecoratedProcedureRecord<TRouter['_def']['record']>;
