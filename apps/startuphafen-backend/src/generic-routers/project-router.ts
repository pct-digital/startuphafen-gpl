import {
  isAllowed,
  Project,
  projectKeysSchema,
  projectSchema,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';

const projectConfig = STARTUPHAFEN_ENTITY_SCHEMA.Project;

export const projectRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(projectSchema.omit({ id: true, userId: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const createEntity = {
          ...req.input,
          userId: req.ctx.token?.sub,
          progress: req.input.progress ?? 0,
        };

        const result = await trx(projectConfig.table.name)
          .insert(createEntity)
          .returning('id');
        return result[0].id;
      });
    }),

  read: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(z.number().optional())
    .output(z.array(projectSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(projectConfig.table.name);
        if (req.input != null) {
          query.where({ id: req.input, userId: req.ctx.token?.sub });
        } else {
          query.where({ userId: req.ctx.token?.sub });
        }

        return query as Promise<Project[]>;
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(projectSchema.partial().omit({ userId: true }))
    .output(z.array(projectSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(projectConfig.table.name);
        if (Object.keys(req.input).length > 0) {
          query.where({ id: req.input.id, userId: req.ctx.token?.sub });
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
        pick: z.array(projectKeysSchema),
        filters: projectSchema.partial().omit({ userId: true }),
      })
    )
    .output(z.array(projectSchema.partial()))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(projectConfig.table.name);
        query.select(...req.input.pick);

        if (Object.keys(req.input.filters).length > 0) {
          query.where({ ...req.input.filters, userId: req.ctx.token?.sub });
        }

        return query as Promise<Partial<Project>[]>;
      });
    }),

  update: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(
      z.object({
        id: z.number(),
        updates: projectSchema.partial().omit({ id: true, userId: true }),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const updates = { ...req.input.updates };
        if (updates.progress !== undefined) {
          updates.progress = Math.max(0, Math.min(100, updates.progress));
        }

        await trx(projectConfig.table.name)
          .where({ id: req.input.id, userId: req.ctx.token?.sub })
          .update(updates);
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
        await trx(projectConfig.table.name)
          .where({ id: req.input, userId: req.ctx.token?.sub })
          .delete();
      });
    }),
  gewADisabled: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(z.number())
    .output(z.union([z.boolean(), z.null()]))
    .query(async (req) => {
      const allowed = await req.ctx.trxFactory(async (trx) => {
        return isAllowed(trx, req.input, req.ctx.token?.sub);
      });

      if (!allowed) return null;

      return await req.ctx.trxFactory(async (trx) => {
        const result = await trx(
          STARTUPHAFEN_ENTITY_SCHEMA.Answers.table.name
        ).where({
          projectId: req.input,
          key: 'Us1',
        });

        for (const e of result) {
          if (
            e.value === 'Freie Berufe' ||
            e.value === 'Dienstleistungen' ||
            e.value === 'Kultur & Kreativwirtschaft'
          ) {
            return true;
          }
        }
        return false;
      });
    }),
});
