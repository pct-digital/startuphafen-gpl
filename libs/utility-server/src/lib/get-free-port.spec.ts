import { getNFreePorts } from './getFreePort';

describe('Free port', () => {
  it('should get three free port', async () => {
    const ports = new Set(await getNFreePorts(8));
    expect(ports.size).toBe(8);
    for (const port of ports) {
      try {
        await fetch('http://localhost:' + port);
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toBe('fetch failed');
      }
    }
  });
});
