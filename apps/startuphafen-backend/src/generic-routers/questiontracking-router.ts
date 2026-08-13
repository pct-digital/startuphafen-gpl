import {
  isAllowed,
  questionTrackingSchema,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const questionTrackingConfig = STARTUPHAFEN_ENTITY_SCHEMA.QuestionTracking;

export const questionTrackingRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(questionTrackingSchema.omit({ id: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const allowed = await isAllowed(
          trx,
          req.input.projectId,
          req.ctx.token?.sub
        );
        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        const result = await trx(questionTrackingConfig.table.name)
          .insert(req.input)
          .returning('id');
        return result[0].id;
      });
    }),

  deleteForProject: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(z.number())
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const allowed = await isAllowed(trx, req.input, req.ctx.token?.sub);
        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        await trx(questionTrackingConfig.table.name)
          .where({ projectId: req.input })
          .delete();
      });
    }),
});
