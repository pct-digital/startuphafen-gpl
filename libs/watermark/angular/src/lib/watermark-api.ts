import { DecoratedProcedureRecord } from '@startuphafen/trpc-root';
import type { WatermarkRouter } from '@startuphafen/watermark/server';

export abstract class WatermarkTrpcService {
  abstract getWatermarkApi(): DecoratedProcedureRecord<
    WatermarkRouter['_def']['record']
  >;
}
