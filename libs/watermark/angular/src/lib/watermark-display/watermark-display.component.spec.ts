import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
import { WatermarkRouter } from '@startuphafen/watermark/server';
import { WatermarkTrpcService } from '../watermark-api';
import { WatermarkDisplayComponent } from './watermark-display.component';

const WATERMARK_TEST_STRING = 'WATERMARK_TEST_STRING';

export class ConcreteWaterMarkTrpcService implements WatermarkTrpcService {
  getWatermarkApi() {
    return createMockTrpcClient<WatermarkRouter>({
      watermark: {
        async query() {
          return WATERMARK_TEST_STRING;
        },
      },
    });
  }
}

describe('WatermarkDisplayComponent', () => {
  let spectator: Spectator<WatermarkDisplayComponent>;
  const createComponent = createComponentFactory({
    component: WatermarkDisplayComponent,
    providers: [
      {
        provide: WatermarkTrpcService,
        useFactory: () => new ConcreteWaterMarkTrpcService(),
      },
    ],
  });

  beforeEach(async () => {
    spectator = createComponent();
  });

  it('should init correctly', () => {
    expect(spectator.component.mark).toBe(WATERMARK_TEST_STRING);
  });
});
