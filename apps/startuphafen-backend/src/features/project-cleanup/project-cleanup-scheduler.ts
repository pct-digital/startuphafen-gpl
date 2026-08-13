import { ProjectCleanupService } from './project-cleanup-service';

type ProjectCleanupSchedulerService = Pick<
  ProjectCleanupService,
  'deleteExpiredProjects'
>;

export class ProjectCleanupScheduler {
  private timer?: NodeJS.Timeout;

  constructor(
    private service: ProjectCleanupSchedulerService,
    private intervalMs = 60 * 60 * 1000
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        console.error('Project cleanup scheduler failed', error);
      });
    }, this.intervalMs);

    this.tick().catch((error) => {
      console.error('Project cleanup scheduler failed', error);
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick() {
    await this.service.deleteExpiredProjects();
  }

}
