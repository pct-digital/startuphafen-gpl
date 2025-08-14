import {
  isAllowed,
  ShQuestionTracking,
  shQuestionTrackingKeysSchema,
  shQuestionTrackingSchema,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';

const shQuestionTrackingConfig = STARTUPHAFEN_ENTITY_SCHEMA.ShQuestionTracking;

export const shQuestionTrackingRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(shQuestionTrackingSchema.omit({ id: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return;

        const result = await trx(shQuestionTrackingConfig.table.name)
          .insert(req.input)
          .returning('id');
        return result[0].id;
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(shQuestionTrackingSchema.partial())
    .output(z.array(shQuestionTrackingSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return [];

        const query = trx(shQuestionTrackingConfig.table.name);
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
        pick: z.array(shQuestionTrackingKeysSchema),
        filters: shQuestionTrackingSchema.partial(),
      })
    )
    .output(z.array(shQuestionTrackingSchema.partial()))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.filters.projectId, req.ctx.token?.sub))
          return [];

        const query = trx(shQuestionTrackingConfig.table.name);
        query.select(...req.input.pick);

        if (Object.keys(req.input.filters).length > 0) {
          query.where(req.input.filters);
        }

        return query as Promise<Partial<ShQuestionTracking>[]>;
      });
    }),

  update: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(
      z.object({
        id: z.number(),
        updates: shQuestionTrackingSchema.partial(),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const projectId = (
          await trx(shQuestionTrackingConfig.table.name).where({
            id: req.input.id,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(shQuestionTrackingConfig.table.name)
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
          await trx(shQuestionTrackingConfig.table.name).where({
            id: req.input,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(shQuestionTrackingConfig.table.name)
          .where({ id: req.input })
          .delete();
      });
    }),
});
