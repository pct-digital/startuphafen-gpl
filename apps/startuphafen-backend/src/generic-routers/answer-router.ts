import {
  Answers,
  answersKeysSchema,
  answersSchema,
  isAllowed,
  Project,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { TRPCError } from '@trpc/server';
import { Knex } from 'knex';
import { z } from 'zod';
import { AnswerDbController } from '../features/common/answer-db-controller';
import { touchesLockedHwkEligibilityKey } from '../features/common/questionnaire-completion';

const answersConfig = STARTUPHAFEN_ENTITY_SCHEMA.Answers;
const projectConfig = STARTUPHAFEN_ENTITY_SCHEMA.Project;

async function ensureEligibilityAnswersAreMutable(
  trx: Knex.Transaction,
  projectId: number,
  keys: string[]
) {
  if (!touchesLockedHwkEligibilityKey(keys)) {
    return;
  }

  const project = await trx<Project>(projectConfig.table.name)
    .where({ id: projectId })
    .first();

  if (project?.progress === 100) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Critical HWK eligibility answers cannot be changed after the questionnaire was completed',
    });
  }
}

export const answerRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(answersSchema.omit({ id: true }))
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

        await ensureEligibilityAnswersAreMutable(trx, req.input.projectId, [
          req.input.key,
        ]);

        const result = await trx(answersConfig.table.name)
          .insert(req.input)
          .returning('id');
        return result[0].id;
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(answersSchema.partial())
    .output(z.array(answersSchema))
    .query(async (req) => {
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
      feature: null,
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
        const allowed = await isAllowed(
          trx,
          req.input.filters.projectId,
          req.ctx.token?.sub
        );
        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

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
      feature: null,
    })
    .input(
      z.object({
        id: z.number(),
        updates: answersSchema.partial().omit({ id: true, projectId: true }),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const answer = await trx<Answers>(answersConfig.table.name)
          .where({
            id: req.input.id,
          })
          .first();

        if (!answer) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Answer not found',
          });
        }

        const allowed = await isAllowed(
          trx,
          answer.projectId,
          req.ctx.token?.sub
        );
        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        await ensureEligibilityAnswersAreMutable(trx, answer.projectId, [
          answer.key,
        ]);

        await trx(answersConfig.table.name)
          .where({ id: req.input.id })
          .update(req.input.updates);
      });
    }),

  delete: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(z.number())
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const answer = await trx<Answers>(answersConfig.table.name)
          .where({
            id: req.input,
          })
          .first();

        if (!answer) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Answer not found',
          });
        }

        const allowed = await isAllowed(
          trx,
          answer.projectId,
          req.ctx.token?.sub
        );
        if (!allowed) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'User is not allowed to access this project',
          });
        }

        await ensureEligibilityAnswersAreMutable(trx, answer.projectId, [
          answer.key,
        ]);

        await trx(answersConfig.table.name).where({ id: req.input }).delete();
      });
    }),

  upsertBatch: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(
      z.object({
        projectId: z.number(),
        answers: z.array(answersSchema.omit({ id: true })),
      })
    )
    .output(z.record(z.string(), z.number()))
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

        await ensureEligibilityAnswersAreMutable(
          trx,
          req.input.projectId,
          req.input.answers.map((answer) => answer.key)
        );

        const controller = new AnswerDbController(trx);
        return await controller.upsertBatch(
          req.input.answers,
          req.input.projectId
        );
      });
    }),

  batchDelete: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
      feature: null,
    })
    .input(
      z.object({
        projectId: z.number(),
        keys: z.array(z.string()),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
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

        await ensureEligibilityAnswersAreMutable(
          trx,
          req.input.projectId,
          req.input.keys
        );

        const controller = new AnswerDbController(trx);
        await controller.batchDelete(req.input.keys, req.input.projectId);
      });
    }),
});
