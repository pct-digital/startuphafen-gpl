import type { Table } from '@rmp135/sql-ts';
import type { Enum } from '@rmp135/sql-ts/dist/Typings';
import type { ForeignKey } from 'knex-schema-inspector/dist/types/foreign-key';
import { ZodSchema, ZodUnion } from 'zod';

/**
 * All entities that this lib interacts with need to have a property "id" which is their primary key
 */
export type EngineEntity = {
  id: number;
};

export type EntityForeignKeyConfiguration = Omit<
  ForeignKey,
  'table' | 'on_update' | 'on_delete'
> & {
  on_update: string;
  on_delete: string;
};

export type EntitySchemaTable = Table & {
  foreignKeys: EntityForeignKeyConfiguration[];
  uniqueConstrains: string[][];
};

export interface EntityDatabaseSchema {
  tables: Record<string, EntitySchemaTable>;
  enums: Record<string, Enum>;
}
export interface EntityConfiguration<E extends EngineEntity> {
  table: EntitySchemaTable;
  /**
   * Due to zod limitations this zod property is not as useful the raw ones
   * directly imported and used from db-entities
   * The raw ones have stuff like omit or partial, this one does not have that.
   *
   * Maybe we could switch to some other validation lib that can do this,
   * or maybe with more zod know-how this can become possible?
   *
   * The question is: How to define a generic zod type that fits with E completely?
   *
   * see https://github.com/colinhacks/zod/discussions/2981
   */
  zod: ZodSchema<E, any, any>;
  zodKeys: ZodUnion<any>;
  keysList: (keyof E)[];
}

export interface AnyEntitiesConfiguration {
  enumTranslations: Record<string, Record<string, string>>;
  schema: EntityDatabaseSchema;
  [key: string]:
    | EntityConfiguration<any>
    | EntityDatabaseSchema
    | Record<string, Record<string, string>>;
}
