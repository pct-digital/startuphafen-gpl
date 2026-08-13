import { HwkMailScheduler } from './hwk-mail-scheduler';

describe('HwkMailScheduler', () => {
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

  it('logs errors on initial and interval ticks', async () => {
    const error = new Error('scheduler failed');
    const service = {
      processDueLogs: jest.fn(async () => {
        throw error;
      }),
    };

    const scheduler = new HwkMailScheduler(service, 1_000, 3);
    scheduler.start();

    await Promise.resolve();
    await Promise.resolve();

    expect(service.processDueLogs).toHaveBeenCalledWith(3);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'HWK mail scheduler failed',
      error
    );

    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });
});
