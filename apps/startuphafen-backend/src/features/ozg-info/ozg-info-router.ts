import { isAllowed } from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { ServerConfig } from '../../config';
import { OzgInfoDbController } from './ozg-info-db-controller';
import { PlzLookupService } from './plz-lookup-service';

const gemeindeEntrySchema = z.object({
  kreis: z.string(),
  gemeinde: z.string(),
  amt: z.string(),
  amtCode: z.string(),
  domain: z.string().nullable(),
  oeid: z.string().optional(),
});

const uniqueAmtSchema = z.object({
  amt: z.string(),
  amtCode: z.string(),
  domain: z.string().nullable(),
  oeid: z.string().optional(),
});

const plzSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'PLZ must consist of exactly 5 digits');

export function buildOzgInfoRouter(config: ServerConfig) {
  const plzLookupService = new PlzLookupService({
    useStagingDomain: config.ozg.useStagingDomain,
  });

  return router({
    getConfig: baseProcedure
      .meta({
        feature: null,
        requiredRolesAny: ['login'],
      })
      .output(
        z.object({
          enableAmtSelection: z.boolean(),
          isOZGOverriden: z.boolean(),
        })
      )
      .query(() => {
        return {
          enableAmtSelection: config.ozg.enableAmtSelection,
          isOZGOverriden: config.ozg.globalOverride != null,
        };
      }),

    lookupPlz: baseProcedure
      .meta({
        feature: null,
        requiredRolesAny: ['login'],
      })
      .input(z.object({ plz: plzSchema }))
      .output(z.array(gemeindeEntrySchema))
      .query(async (req) => {
        return plzLookupService.lookup(req.input.plz);
      }),

    saveForProject: baseProcedure
      .meta({
        feature: null,
        requiredRolesAny: ['login'],
      })
      .input(
        z.object({
          projectId: z.number(),
          plz: plzSchema,
        })
      )
      .output(z.number())
      .mutation(async (req) => {
        const { projectId, plz } = req.input;

        return req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, projectId, req.ctx.token?.sub);
          if (!allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Not authorized to modify this project',
            });
          }

          const entries = await plzLookupService.lookup(plz);

          const controller = new OzgInfoDbController(trx);
          return controller.replaceForProject(projectId, plz, entries);
        });
      }),

    getUniqueAmts: baseProcedure
      .meta({
        feature: null,
        requiredRolesAny: ['login'],
      })
      .input(z.object({ projectId: z.number() }))
      .output(z.array(uniqueAmtSchema))
      .query(async (req) => {
        const { projectId } = req.input;

        return req.ctx.trxFactory(async (trx) => {
          const allowed = await isAllowed(trx, projectId, req.ctx.token?.sub);
          if (!allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Not authorized to access this project',
            });
          }

          const controller = new OzgInfoDbController(trx);
          return await controller.getUniqueAmtsByProjectId(projectId);
        }, true);
      }),
  });
}
