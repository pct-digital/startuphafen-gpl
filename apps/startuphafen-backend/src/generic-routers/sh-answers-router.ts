import {
  isAllowed,
  ShAnswers,
  shAnswersKeysSchema,
  shAnswersSchema,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';

const shAnswersConfig = STARTUPHAFEN_ENTITY_SCHEMA.ShAnswers;

export const shAnswerRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(shAnswersSchema.omit({ id: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return;

        const result = await trx(shAnswersConfig.table.name)
          .insert(req.input)
          .returning('id');
        return result[0].id;
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(shAnswersSchema.partial())
    .output(z.array(shAnswersSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return [];

        const query = trx(shAnswersConfig.table.name);
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
        pick: z.array(shAnswersKeysSchema),
        filters: shAnswersSchema.partial(),
      })
    )
    .output(z.array(shAnswersSchema.partial()))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.filters.projectId, req.ctx.token?.sub))
          return [];

        const query = trx(shAnswersConfig.table.name);
        query.select(...req.input.pick);

        if (Object.keys(req.input.filters).length > 0) {
          query.where(req.input.filters);
        }

        return query as Promise<Partial<ShAnswers>[]>;
      });
    }),

  update: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(
      z.object({
        id: z.number(),
        updates: shAnswersSchema.partial(),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const projectId = (
          await trx(shAnswersConfig.table.name).where({
            id: req.input.id,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(shAnswersConfig.table.name)
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
          await trx(shAnswersConfig.table.name).where({
            id: req.input,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(shAnswersConfig.table.name).where({ id: req.input }).delete();
      });
    }),
});
