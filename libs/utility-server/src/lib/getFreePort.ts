import { sleep } from '@startuphafen/utility';
import * as net from 'net';

export async function getPortFree() {
  return new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const adr = srv.address();
      if (typeof adr === 'string') {
        reject('ADR is a string?!');
      } else if (adr == null) {
        reject('ADR is null');
      } else {
        const port = adr.port;
        setTimeout(() => {
          srv.close(() => resolve(port));
        }, 100);
      }
    });
  });
}

export async function getPortPairFree() {
  return new Promise<{ portOne: number; portTwo: number }>(
    (resolve, reject) => {
      const srv = net.createServer();
      const srv2 = net.createServer();
      srv.listen(0, () => {
        srv2.listen(0, () => {
          const adr = srv.address();
          const adr2 = srv2.address();
          if (typeof adr === 'string' || typeof adr2 === 'string') {
            reject('ADR is a string?!');
          } else if (adr == null || adr2 == null) {
            reject('ADR is null');
          } else {
            const portOne = adr.port;
            const portTwo = adr2.port;
            setTimeout(() => {
              srv.close(() =>
                setTimeout(() => {
                  srv2.close(() =>
                    resolve({ portOne: portOne, portTwo: portTwo })
                  );
                }, 100)
              );
            }, 100);
          }
        });
      });
    }
  );
}

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
