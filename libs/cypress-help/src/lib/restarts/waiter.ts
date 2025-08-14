import { sleep } from '@startuphafen/utility';

const SLEEP_TIME = 100;

export async function waitForCheckPass(
  check: () => Promise<boolean>,
  successCountNeeded: number,
  timeoutSeconds: number
) {
  const startTime = Date.now();
  let successCount = 0;
  for (;;) {
    try {
      const ok = await check();
      if (ok) {
        successCount++;
      } else {
        successCount = 0;
      }
    } catch (e) {
      successCount = 0;
    }

    await sleep(SLEEP_TIME);

    const timeWaited = (Date.now() - startTime) / 1000;
    if (timeWaited >= timeoutSeconds) {
      throw new Error(
        'got timeout waiting for a server to startup, see docker.log for what is going on'
      );
    }

    if (successCountNeeded <= successCount) {
      break;
    }
  }
}
