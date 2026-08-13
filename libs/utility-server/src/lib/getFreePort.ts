import { sleep } from '@startuphafen/utility';
import * as net from 'net';

export async function getNFreePorts(n: number): Promise<number[]> {
  const servers: Promise<net.Server>[] = [...Array(n)].map((_d) => {
    return new Promise((res) => {
      const srv = net.createServer();
      srv.listen(0, () => {
        return res(srv);
      });
    });
  });

  const result: number[] = [];

  for (const serverPromise of servers) {
    const server = await serverPromise;

    const adr = server.address();
    if (typeof adr === 'string') {
      throw new Error('adr is a string?: ' + adr);
    }
    if (adr == null) {
      throw new Error('adr is null');
    }
    const p = adr.port;

    result.push(p);
  }

  for (const serverPromise of servers) {
    const server = await serverPromise;
    await new Promise((resolve) => server.close(resolve));
  }

  // A short sleep seems to be necessary to increase stability, i.e. make sure the ports are really free again
  await sleep(250);

  return result;
}
