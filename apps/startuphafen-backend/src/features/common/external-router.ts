import { FinanzaemterSchema } from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { ServerConfig } from '../../config';

export function buildExtRouter(serverConfig: ServerConfig) {
  return router({
    getStrapiUrl: baseProcedure
      .meta({
        requiredRolesAny: ['startuphafen-admin'],
        feature: null,
      })
      .output(z.string())
      .query(async () => {
        return serverConfig.matchingStrapi.url;
      }),

    getFinanzaemter: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-high'],
        feature: null,
      })
      .output(FinanzaemterSchema)
      .query(async () => {
        return serverConfig.eric.finanzaemter;
      }),
  });
}
