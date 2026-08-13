import { waitForCheckPass } from './waiter';

export async function waitForKeycloak(kcHost: string) {
  await waitForCheckPass(
    async () => {
      const response = await fetch(kcHost + '/health/ready');
      const body = await response.json();
      return body.status === 'UP';
    },
    3,
    120000000
  );
}
