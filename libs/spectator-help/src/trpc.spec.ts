import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { createMockTrpcClient } from './trpc';

const testRouter = router({
  stringLength: baseProcedure
    .input(z.string())
    .output(z.number())
    .query(async () => {
      throw new Error(
        'test will never call this, only needs the type from this'
      );
    }),
  add: baseProcedure
    .input(
      z.object({
        a: z.number(),
        b: z.number(),
      })
    )
    .output(z.number())
    .mutation(async () => {
      throw new Error(
        'test will never call this, only needs the type from this'
      );
    }),
  subrouter: router({
    helloWorld: baseProcedure
      .input(z.string())
      .output(z.string())
      .query(async () => {
        throw new Error(
          'test will never call this, only needs the type from this'
        );
      }),
  }),
});

type TestRouter = typeof testRouter;

describe('createMockTrpClient', () => {
  it('works on a mutate function', async () => {
    const mockClient = createMockTrpcClient<TestRouter>({
      add: {
        async mutate(input: any) {
          return input.a + input.b;
        },
      },
    });

    const result = await mockClient.add.mutate({
      a: 1,
      b: 2,
    });

    expect(result).toBe(3);
  });

  it('works on a query function', async () => {
    const mockClient = createMockTrpcClient<TestRouter>({
      stringLength: {
        async query(input: any) {
          return input.length;
        },
      },
    });

    expect(await mockClient.stringLength.query('test')).toBe(4);
  });

  it('works on subrouters', async () => {
    const mockClient = createMockTrpcClient<TestRouter>({
      subrouter: {
        helloWorld: {
          async query(input: any) {
            return 'Hello ' + input;
          },
        },
      },
    });

    expect(await mockClient.subrouter.helloWorld.query('Colin')).toBe(
      'Hello Colin'
    );
  });

  it('throws on unimplemented functions', async () => {
    const emptyClient = createMockTrpcClient<TestRouter>({});

    let ok = false;

    try {
      await emptyClient.add.mutate({ a: 1, b: 1 });
    } catch (e: any) {
      ok = e.message.includes('mock trpc client does not have');
    }

    expect(ok).toBeTruthy();
  });

  it('allows to patch existing clients', async () => {
    const mockClientA = createMockTrpcClient<TestRouter>({
      add: {
        async mutate(input: any) {
          return input.a + input.b;
        },
      },
      stringLength: {
        query: async (x: any) => x.length + 1,
      },
    });

    const mockClientB = createMockTrpcClient<TestRouter>(
      {
        stringLength: {
          query: async (x: any) => x.length,
        },
      },
      mockClientA
    );

    expect(await mockClientA.stringLength.query('A')).toBe(2);
    expect(await mockClientB.stringLength.query('A')).toBe(1);
    expect(
      await mockClientB.add.mutate({
        a: 1,
        b: 2,
      })
    ).toBe(3);
  });
});
