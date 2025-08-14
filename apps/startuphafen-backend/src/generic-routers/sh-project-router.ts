import {
  gewaDisabledAnswers,
  isAllowed,
  Project,
  ShProject,
  shProjectKeysSchema,
  shProjectSchema,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';

const shProjectConfig = STARTUPHAFEN_ENTITY_SCHEMA.ShProject;

export const shProjectRouter = router({
  create: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(shProjectSchema.omit({ id: true, userId: true }))
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const createEntity = {
          ...req.input,
          userId: req.ctx.token?.sub,
          progress: req.input.progress ?? 0,
        };

        const result = await trx(shProjectConfig.table.name)
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
    .output(z.array(shProjectSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(shProjectConfig.table.name);
        if (req.input != null) {
          query.where({ id: req.input, userId: req.ctx.token?.sub });
        } else {
          query.where({ userId: req.ctx.token?.sub });
        }

        return query as Promise<ShProject[]>;
      });
    }),

  readFiltered: baseProcedure
    .meta({
      requiredRolesAny: ['login'],
    })
    .input(shProjectSchema.partial().omit({ userId: true }))
    .output(z.array(shProjectSchema))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(shProjectConfig.table.name);
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
        pick: z.array(shProjectKeysSchema),
        filters: shProjectSchema.partial().omit({ userId: true }),
      })
    )
    .output(z.array(shProjectSchema.partial()))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(shProjectConfig.table.name);
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
        updates: shProjectSchema.partial().omit({ id: true, userId: true }),
      })
    )
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        const updates = { ...req.input.updates };
        if (updates.progress !== undefined) {
          updates.progress = Math.max(0, Math.min(100, updates.progress));
        }

        await trx(shProjectConfig.table.name)
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
        await trx(shProjectConfig.table.name)
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
          STARTUPHAFEN_ENTITY_SCHEMA.ShAnswers.table.name
        ).where({
          projectId: req.input,
          key: 'Us1',
        });

        for (const e of result) {
          if (gewaDisabledAnswers.includes(e.value)) {
            return true;
          }
        }
        return false;
      });
    }),
});
