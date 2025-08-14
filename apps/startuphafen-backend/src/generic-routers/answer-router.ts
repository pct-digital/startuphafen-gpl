import {
  Answers,
  answersKeysSchema,
  answersSchema,
  isAllowed,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';

const answersConfig = STARTUPHAFEN_ENTITY_SCHEMA.Answers;

export const answersRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(answersSchema.omit({ id: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return;

        const result = await trx(answersConfig.table.name)
          .insert(req.input)
          .returning('id');
        return result[0].id;
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(answersSchema.partial())
    .output(z.array(answersSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.projectId, req.ctx.token?.sub)) return [];

        const query = trx(answersConfig.table.name);
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
        pick: z.array(answersKeysSchema),
        filters: answersSchema.partial(),
      })
    )
    .output(z.array(answersSchema.partial()))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        if (!isAllowed(trx, req.input.filters.projectId, req.ctx.token?.sub))
          return [];

        const query = trx(answersConfig.table.name);
        query.select(...req.input.pick);

        if (Object.keys(req.input.filters).length > 0) {
          query.where(req.input.filters);
        }

        return query as Promise<Partial<Answers>[]>;
      });
    }),

  update: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(
      z.object({
        id: z.number(),
        updates: answersSchema.partial(),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const projectId = (
          await trx(answersConfig.table.name).where({
            id: req.input.id,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(answersConfig.table.name)
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
          await trx(answersConfig.table.name).where({
            id: req.input,
          })
        )[0].projectId;

        if (!isAllowed(trx, projectId, req.ctx.token?.sub)) return;

        await trx(answersConfig.table.name).where({ id: req.input }).delete();
      });
    }),
});
