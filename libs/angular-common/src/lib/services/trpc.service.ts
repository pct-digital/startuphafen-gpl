import { Injectable } from '@angular/core';
import { superjson } from '@startuphafen/utility';
import { WatermarkTrpcService } from '@startuphafen/watermark/angular';
import { createTRPCProxyClient, httpLink, loggerLink } from '@trpc/client';
import { KeycloakService } from 'keycloak-angular';
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { AppRouter } from '../../../../../apps/startuphafen-backend/src/router';
@Injectable({
  providedIn: 'root',
})
export class TrpcService implements WatermarkTrpcService {
  constructor(private keycloak: KeycloakService) {}

  public client = createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      loggerLink({
        enabled: (opts) =>
          opts.direction === 'down' && opts.result instanceof Error,
      }),
      httpLink({
        url: '/trpc',
        headers: async () => {
          if (await this.keycloak.isLoggedIn()) {
            return {
              Authorization: 'Bearer ' + (await this.keycloak.getToken()),
            };
          }
          return {};
        },
      }),
    ],
  });

  getWatermarkApi() {
    return this.client.WaterMark;
  }

  getHello() {
    return this.client.hello;
  }
}
