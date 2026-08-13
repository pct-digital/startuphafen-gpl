import { HwkMailService } from './hwk-mail-service';

type HwkMailSchedulerService = Pick<HwkMailService, 'processDueLogs'>;

export class HwkMailScheduler {
  private timer?: NodeJS.Timeout;

  constructor(
    private service: HwkMailSchedulerService,
    private intervalMs = 30_000,
    private batchSize = 10
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        console.error('HWK mail scheduler failed', error);
      });
    }, this.intervalMs);

    this.tick().catch((error) => {
      console.error('HWK mail scheduler failed', error);
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick() {
    await this.service.processDueLogs(this.batchSize);
  }

}
