import { AnonymousUser, baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';

export const WatermarkSchema = z.object({
  text: z.string(),
});

export type WaterMarkConfig = z.infer<typeof WatermarkSchema>;

export function getBuildProcedure(waterMarkConfig: WaterMarkConfig) {
  return {
    watermark: baseProcedure
      .meta({
        requiredRolesAny: AnonymousUser,
      })
      .input(z.void())
      .output(z.string())
      .query(() => {
        return waterMarkConfig.text;
      }),
  };
}

export function createWatermarkRouter(waterMarkConfig: WaterMarkConfig) {
  const watermarkRouter = router(getBuildProcedure(waterMarkConfig));

  return watermarkRouter;
}

export type WatermarkRouter = ReturnType<typeof createWatermarkRouter>;
