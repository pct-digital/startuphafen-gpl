/**
 * Free Port Utility
 *
 * Finds available TCP ports on the local machine.
 * Used by SSH tunnel helper to auto-select local ports.
 */

import * as net from 'net';

/**
 * Get a single free TCP port.
 *
 * Works by binding to port 0 (OS assigns a free port), reading the assigned
 * port, then closing the server. There's a small race window between closing
 * and using the port, but it's acceptable for our use case.
 *
 * @returns Promise resolving to an available port number
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to get server address'));
        return;
      }

      const port = address.port;
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(port);
        }
      });
    });

    server.on('error', reject);
  });
}

/**
 * Check if a port is accepting connections on localhost.
 *
 * @param port - Port number to check
 * @param timeoutMs - Connection timeout in milliseconds (default: 100)
 * @returns Promise resolving to true if port is accepting connections
 */
export function isPortOpen(port: number, timeoutMs = 100): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      cleanup();
      resolve(true);
    });

    socket.on('timeout', () => {
      cleanup();
      resolve(false);
    });

    socket.on('error', () => {
      cleanup();
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Wait for a port to start accepting connections.
 *
 * Polls the port at regular intervals until it accepts a connection
 * or the timeout is reached.
 *
 * @param port - Port number to wait for
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10000)
 * @param pollIntervalMs - Time between poll attempts in milliseconds (default: 100)
 * @returns Promise resolving when port is open, rejects on timeout
 */
export async function waitForPort(
  port: number,
  timeoutMs = 10000,
  pollIntervalMs = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isPortOpen(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timeout waiting for port ${port} to become available after ${timeoutMs}ms`
  );
}
