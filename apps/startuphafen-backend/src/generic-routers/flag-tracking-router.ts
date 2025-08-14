import {
  FlagTracking,
  flagTrackingKeysSchema,
  flagTrackingSchema,
  isAllowed,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';

const flagTrackingConfig = STARTUPHAFEN_ENTITY_SCHEMA.FlagTracking;

export const flagTrackingRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(flagTrackingSchema.omit({ id: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return;

        const result = await trx(flagTrackingConfig.table.name)
          .insert(req.input)
          .returning('id');
        return result[0].id;
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(flagTrackingSchema.partial())
    .output(z.array(flagTrackingSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return [];

        const query = trx(flagTrackingConfig.table.name);
        if (Object.keys(req.input).length > 0) {
          query.where(req.input);
        }
        return query;
      });
    }),

  pickFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(
      z.object({
        pick: z.array(flagTrackingKeysSchema),
        filters: flagTrackingSchema.partial(),
      })
    )
    .output(z.array(flagTrackingSchema.partial()))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.filters.projectId, req.ctx.token?.sub))
          return [];

        const query = trx(flagTrackingConfig.table.name);
        query.select(...req.input.pick);

        if (Object.keys(req.input.filters).length > 0) {
          query.where(req.input.filters);
        }

        return query as Promise<Partial<FlagTracking>[]>;
      });
    }),

  update: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(
      z.object({
        id: z.number(),
        updates: flagTrackingSchema.partial(),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const projectId = (
          await trx(flagTrackingConfig.table.name).where({
            id: req.input.id,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(flagTrackingConfig.table.name)
          .where({ id: req.input.id })
          .update(req.input.updates);
      });
    }),

  delete: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(z.number())
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const projectId = (
          await trx(flagTrackingConfig.table.name).where({
            id: req.input,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(flagTrackingConfig.table.name)
          .where({ id: req.input })
          .delete();
      });
    }),
});
