import {
  EngineEntity,
  EntityConfiguration,
  PickFilteredRequest,
  ReadWhereInRequestPart,
  UniqueEntityRequest,
  UpdateEntityRequest,
} from '@startuphafen/entity-engine/common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { Knex } from 'knex';
import { AnyZodObject, z } from 'zod';

export interface GenericCrudOptions<E extends EngineEntity> {
  /**
   * Allows to server-side modify an entity before it is created to for example enforce certain things
   * like setting a field to the current user id for tracking who created some entity.
   * The given transaction sees the database right before the creation
   *
   * !!! Apart from database interactions this must be side effect free!
   *
   */
  creationHook?: (
    entity: Omit<E, 'id'>,
    trx: Knex.Transaction
  ) => Promise<Omit<E, 'id'>>;

  /**
   * Allows to server-side modify an entity before it is updated to for example enforce certain things
   * like setting a field to the current user id for tracking who last updated some entity
   *
   * !!! Apart from database interactions this must be side effect free!
   *
   * The given transaction sees the database right before the update
   */
  updateHook?: (
    entityId: number,
    entity: Partial<E>,
    trx: Knex.Transaction
  ) => Promise<Partial<E>>;
}

const deleteUndefinedProperties = (x: any) => {
  for (const k of Object.keys(x)) {
    if (x[k] === undefined) {
      delete x[k];
    }
  }
};

export function buildGenericCrudRouter<E extends EngineEntity>(
  config: EntityConfiguration<E>,
  options?: GenericCrudOptions<E>
) {
  // I tried hard to get this to work correctly with all type inferences, but that is a very hard problem
  // see https://github.com/colinhacks/zod/discussions/2981
  const zodAny: AnyZodObject = config.zod as any;

  const listUniqueConstrainViolations = baseProcedure
    .input((val: unknown) => {
      z.object({
        id: z.number().nullable(),
        updates: zodAny.partial(),
      }).parse(val);
      return val as UniqueEntityRequest<E>;
    })
    .output(z.array(z.array(z.string())))
    .query(async (req) => {
      const values = req.input;
      if (values == null) {
        return [];
      }

      const result: string[][] = [];

      const currentValue: any = {};

      await req.ctx.trxFactory(async (trx) => {
        if (values.id != null) {
          const rows: E[] = await trx(config.table.name).where({
            id: values.id,
          });
          if (rows.length > 0) {
            Object.assign(currentValue, rows[0]);
          }
        }

        for (const uniquePropCombination of config.table.uniqueConstrains) {
          const whereObject: any = {};
          let noop = false;
          for (const propKey of uniquePropCombination) {
            const updateValue = (values.updates as any)[propKey];
            if (updateValue == null) {
              if (currentValue[propKey] == null) {
                noop = true;
                break;
              }
              whereObject[propKey] = currentValue[propKey];
            } else {
              whereObject[propKey] = updateValue;
            }
          }

          if (noop) continue;

          const candidates = await trx(config.table.name).where(whereObject);
          const conflicts = candidates.filter((c) => c.id !== values.id);
          if (conflicts.length > 0) {
            result.push(uniquePropCombination);
          }
        }
      });

      return result;
    });

  const create = baseProcedure
    .input((val: unknown) => {
      const omitObject: any = { id: true };
      const result = zodAny.omit(omitObject).parse(val) as Omit<E, 'id'>;
      return result;
    })
    .output(z.number())
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        let createEntity = req.input as Omit<E, 'id'>;
        if (options?.creationHook) {
          createEntity = await options?.creationHook(createEntity, trx);
        }

        const result = await trx(config.table.name)
          .insert(createEntity)
          .returning('id');
        return result[0].id as number;
      });
    });

  const batchCreate = baseProcedure
    .input((val: unknown) => {
      const omitObject: any = { id: true };
      const zodAnyArray = z.array(zodAny.omit(omitObject));
      return zodAnyArray.parse(val) as Omit<E, 'id'>[];
    })
    .output(z.array(z.number()))
    .mutation(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const result: number[] = [];
        for (const input of req.input) {
          let createEntity = input as Omit<E, 'id'>;
          if (options?.creationHook) {
            createEntity = await options.creationHook(createEntity, trx);
          }

          const id = await trx(config.table.name)
            .insert(createEntity)
            .returning('id');
          result.push(id[0].id as number);
        }

        return result;
      });
    });

  const read = baseProcedure
    .input(z.number().optional())
    .output(z.array(config.zod))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(config.table.name);
        if (req.input != null) {
          await query.where({
            id: req.input,
          });
        }
        const result: E[] = await query;
        return result;
      });
    });

  const readFiltered = baseProcedure
    .input((val: unknown) => {
      const result = zodAny.partial().parse(val) as Partial<E>;
      deleteUndefinedProperties(result);
      return result;
    })
    .output(z.array(config.zod))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(config.table.name);
        if (req.input != null) {
          await query.where(req.input);
        }
        const result: E[] = await query;
        return result;
      });
    });

  const readWhereIn = baseProcedure
    .input((val: any) => {
      config.zodKeys.parse(val.key);

      const key: keyof E = val.key;
      const keySchema = zodAny.shape[key];
      const validation = z.object({
        key: config.zodKeys,
        values: z.array(keySchema),
      });

      return validation.parse(val) as ReadWhereInRequestPart<E, any>;
    })
    .output(z.array(config.zod))
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(config.table.name);
        if (req.input != null) {
          await query.whereIn(req.input.key, req.input.values);
        }

        const result: E[] = await query;
        return result;
      });
    });

  const pickFiltered = baseProcedure
    .input((val: unknown) => {
      const validation = z.object({
        pick: z.array(config.zodKeys),
        filters: zodAny.partial(),
      });
      const result = validation.parse(val) as PickFilteredRequest<E>;
      deleteUndefinedProperties(result.filters);
      return result;
    })
    .output((val: unknown) => {
      z.array(zodAny.partial()).parse(val);
      return val as Pick<E, any>[];
    })
    .query(async (req) => {
      return await req.ctx.trxFactory(async (trx) => {
        const query = trx(config.table.name);
        await query.select(...(req.input?.pick ?? []));
        if (req.input != null) {
          await query.where(req.input.filters);
        }
        const result: Pick<E, any>[] = await query;
        return result;
      });
    });

  const update = baseProcedure
    .input((val: unknown) => {
      return z
        .object({
          id: z.number(),
          updates: zodAny.partial(),
        })
        .strict()
        .parse(val) as UpdateEntityRequest<E>;
    })
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        let updateEntity = req.input.updates as Partial<E>;
        if (options?.updateHook) {
          updateEntity = await options?.updateHook(
            req.input.id,
            updateEntity,
            trx
          );
        }
        await trx(config.table.name).update(updateEntity).where({
          id: req.input.id,
        });
      });
    });

  const delFunc = baseProcedure
    .input(z.number())
    .output(z.void())
    .mutation(async (req) => {
      await req.ctx.trxFactory(async (trx) => {
        await trx(config.table.name)
          .where({
            id: req.input,
          })
          .delete();
      });
    });

  return router({
    read,
    readWhereIn,
    readFiltered,
    pickFiltered,
    create,
    batchCreate,
    update,
    delete: delFunc,
    listUniqueConstrainViolations,
  });
}
