import { sleep } from '@startuphafen/utility';
import slugify from 'slugify';

export async function resetTestserverForApp(
  testServerUrl: string,
  scenarioName: string
) {
  const N = 50;
  for (let i = 0; i < N; i++) {
    try {
      // attempt and scenario are both just added for debugging help, since they are seen quickly in the logs
      // they are not used by the server
      await fetch(
        testServerUrl +
          '/dev/resetServer?attempt=' +
          i +
          '&=scenario=' +
          slugify(scenarioName),
        {
          method: 'GET',
        }
      );
    } catch (e: any) {
      console.log(
        new Date().toLocaleString('de-DE') +
          ': Failed to reset the server  Will try a few more times',
        e
      );
      if (i === N - 1)
        throw new Error(
          new Date().toLocaleString('de-DE') +
            ': test server appears to be offline ' +
            e.message +
            '; ' +
            JSON.stringify(e, Object.getOwnPropertyNames(e))
        );
      await sleep(i * 100 + 500);

      continue;
    }

    break;
  }
}
