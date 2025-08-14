import type { Table } from '@rmp135/sql-ts';
import type { Enum } from '@rmp135/sql-ts/dist/Typings';
import type { ForeignKey } from 'knex-schema-inspector/dist/types/foreign-key';
import { ZodSchema, ZodUnion, z } from 'zod';

/**
 * All entities that this lib interacts with need to have a property "id" which is their primary key
 */
export type EngineEntity = {
  id: number;
};

export interface UpdateEntityRequest<T> {
  id: number;
  updates: Partial<T>;
}

export interface UniqueEntityRequest<T> {
  id: number | null;
  updates: Partial<T>;
}

export interface PickFilteredRequest<E extends EngineEntity> {
  pick: (keyof E)[];
  filters: Partial<E>;
}

export interface ReadWhereInRequestPart<E extends EngineEntity, K extends keyof E> {
  key: K;
  values: E[K][];
}

export type KeyDescriptions<E extends EngineEntity> = {
  [key in keyof E]: string;
} & Record<string, string>;

// these are based on the available form field types in entity-engine-angular.module.ts
// Here only the ones are listed which are not selected by default, so these are only used if selected in the entity.ts
export type CustomFieldTypeValues = `${'string' | 'number'}-euro` | 'kwp' | 'template-file' | 'template-pdf' | 'decimal-percent';

export type CustomFieldTypes<E extends EngineEntity> = {
  [key in keyof E]?: CustomFieldTypeValues;
} & Record<string, string>;

export type ForeignKeyRestrictions<E extends EngineEntity, EKRecord extends Record<string, any>> = {
  [key in keyof EKRecord]?: (e: Partial<E>) => Partial<EKRecord[key]>;
};

export type EntityForeignKeyConfiguration = Omit<ForeignKey, 'table' | 'on_update' | 'on_delete'> & {
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
  [key: string]: EntityConfiguration<any> | EntityDatabaseSchema | Record<string, Record<string, string>>;
}

export function isEntityConfiguration(value: any): value is EntityConfiguration<any> {
  return 'table' in value && 'userDisplayData' in value && typeof value.userDisplayData.propertyTranslation === 'object';
}

export const RelationSetValuesSchema = z.object({
  columnAName: z.string(),
  columnAValue: z.number(),
  columnBName: z.string(),
  columnBValues: z.array(z.number()),
});

export type RelationSetValues = z.infer<typeof RelationSetValuesSchema>;

export const RelationGetValuesSchema = z.object({
  fixedColumnName: z.string(),
  fixedColumnValue: z.number(),
});

export type RelationGetValues = z.infer<typeof RelationGetValuesSchema>;
