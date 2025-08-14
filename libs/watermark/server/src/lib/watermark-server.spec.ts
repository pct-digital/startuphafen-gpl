import { initTRPC } from '@trpc/server';
import { getBuildProcedure } from './watermark-server';

const t = initTRPC.context<object>().create();

describe('watermarkServer', () => {
  it('returns correct string', async () => {
    const WATERMARK_TEST_STRING = 'WATERMARK_TEST_STRING';
    const router = t.router(getBuildProcedure({ text: WATERMARK_TEST_STRING }));
    const caller = router.createCaller({});

    const output = await caller.watermark();
    expect(output).toBe(WATERMARK_TEST_STRING);
  });
});
