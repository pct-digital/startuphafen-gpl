import { ProjectCleanupScheduler } from './project-cleanup-scheduler';

describe('ProjectCleanupScheduler', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it('runs the cleanup on the initial tick and on every interval', async () => {
    const service = {
      deleteExpiredProjects: jest.fn(async () => 0),
    };

    const scheduler = new ProjectCleanupScheduler(service, 1_000);
    scheduler.start();

    await Promise.resolve();

    expect(service.deleteExpiredProjects).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1_000);
    await Promise.resolve();

    expect(service.deleteExpiredProjects).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('logs errors on initial and interval ticks', async () => {
    const error = new Error('cleanup failed');
    const service = {
      deleteExpiredProjects: jest.fn(async () => {
        throw error;
      }),
    };

    const scheduler = new ProjectCleanupScheduler(service, 1_000);
    scheduler.start();

    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Project cleanup scheduler failed',
      error
    );

    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('stops ticking after stop is called', async () => {
    const service = {
      deleteExpiredProjects: jest.fn(async () => 0),
    };

    const scheduler = new ProjectCleanupScheduler(service, 1_000);
    scheduler.start();

    await Promise.resolve();
    scheduler.stop();

    jest.advanceTimersByTime(10_000);
    await Promise.resolve();

    expect(service.deleteExpiredProjects).toHaveBeenCalledTimes(1);
  });
});
