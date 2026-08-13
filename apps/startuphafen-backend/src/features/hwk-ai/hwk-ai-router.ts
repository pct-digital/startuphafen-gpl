import {
  HwkAiResultSchema,
  isAllowed,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { Knex } from 'knex';
import { z } from 'zod';
import { ServerConfig } from '../../config';
import { FeatureFlagDbController } from '../common/feature-flag-db-controller';
import { HwkAiService } from './hwk-ai-service';
import { VectorStoreService } from '../common/vector-store';

async function ensureHwkEnabled(trx: Knex.Transaction): Promise<void> {
  const featureFlagDbController = new FeatureFlagDbController(trx);
  const row = await featureFlagDbController.getByName('hwk');

  if (!row) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Resource could not be found.',
    });
  }

  if (!row.enabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Resource is deactivated.',
    });
  }
}

export function buildHwkAiRouter(serverConfig: ServerConfig) {
  const vectorStoreService = serverConfig.mistral
    ? new VectorStoreService(
        serverConfig.mistral.apiKey,
        serverConfig.knex.connection
      )
    : null;

  const hwkAiService = serverConfig.mistral
    ? new HwkAiService(serverConfig.mistral.apiKey, vectorStoreService!)
    : null;

  if (!serverConfig.mistral) {
    console.warn('Warning, no mistral api key is set, hwk-ai will not work');
  }

  return router({
    analyze: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(
        z.object({
          projectId: z.number().int().positive(),
          description: z.string().trim().min(1).max(2000),
        })
      )
      .output(HwkAiResultSchema)
      .mutation(async (req) => {
        await req.ctx.trxFactory(async (trx) => {
          await ensureHwkEnabled(trx);
        });

        if (!serverConfig.mistral || !hwkAiService) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'API Key not configured',
          });
        }

        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input.projectId, req.ctx.token?.sub);
        });

        if (!allowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied',
          });
        }

        return hwkAiService.analyze(req.input.description);
      }),
  });
}
