import sqlts from '@rmp135/sql-ts';
import { DbMigrator } from '@startuphafen/db-migration';
import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';
import _ from 'lodash';
import path from 'path';
import { generate as generateZod } from 'ts-to-zod';

import { distinctGroupBy } from '@startuphafen/utility';
import schemaInspector from 'knex-schema-inspector';

import { DBMigrationSchema } from '@startuphafen/db-migration';
import { ConfigLoader } from '@startuphafen/utility-server';
import { Knex } from 'knex';
import prettier from 'prettier';
import { z } from 'zod';

export interface EntitiesInformationFiles {
  entitiesFileContent: string;
  schemaInformation: string; // json information on the schema with separate foreign key information
}

function getFileNames() {
  const entitiesFileName = 'generated/db-entities.ts';
  const schemaFileName = 'generated/db-schema.json';

  return {
    entitiesFileName,
    schemaFileName,
  };
}

function determineCommonSrcPath() {
  return path.join('libs', 'startuphafen-common', 'src');
}

export async function prepareAllEntitiesOutputs(
  appName: string,
  migrationMode: 'push' | 'deploy'
) {
  const projectPath = path.join('apps', appName);
  const commonPath = determineCommonSrcPath();

  const fileNames = getFileNames();

  const typesOutputPath = path.join(commonPath, fileNames.entitiesFileName);
  const schemaOutputPath = path.join(commonPath, fileNames.schemaFileName);

  const files = await buildEntitiesFilesForProject(projectPath, migrationMode);

  const typesFileContent = (
    await prettier.format(files.entitiesFileContent, {
      parser: 'typescript',
    })
  )
    .replace(
      'Rerun sql-ts to regenerate this file.',
      `\n * !!!!DO NOT MODIFY THIS FILE BY HAND!!!!\n * !!!!DO NOT MODIFY THIS FILE BY HAND!!!!\n * !!!!DO NOT MODIFY THIS FILE BY HAND!!!!\n * Rerun npx nx run ${appName}-server:entities to update this file from the newest database migration files. * Begin using this by defining a file called user-entities.ts in common where you can define entity types not present in the database
 * and especially define your full ENTITY_SCHEMA:
 * 
 * export const YOUR_APP_ENTITY_SCHEMA = buildEntitySchemaConfigurations({... fill this as enforced by the type system});`
    )
    .replace(
      'export const TABLES',
      'export const ' + _.camelCase(appName).toUpperCase() + '_TABLES'
    );

  return {
    [typesOutputPath]:
      `/* eslint-disable @typescript-eslint/no-empty-object-type */ \n // Generated ${new Date().toISOString()} \n` +
      typesFileContent,
    [schemaOutputPath]: files.schemaInformation,
  };
}

export async function getUniqueConstraintsForTable(
  tableSchema: string,
  tableName: string,
  knex: Knex
) {
  const query = `
  SELECT con.conname AS constraint_name,
       con.conrelid::regclass AS table_name,
       ARRAY_AGG(a.attname) AS column_names
FROM pg_catalog.pg_constraint con
INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
INNER JOIN pg_catalog.pg_attribute a ON a.attnum = ANY(con.conkey) AND a.attrelid = con.conrelid
WHERE nsp.nspname = '${tableSchema}'
      AND rel.relname = '${tableName}'
      AND con.contype = 'u'
GROUP BY constraint_name, table_name;
  `;

  const uniqueList = await knex.raw(query);

  const result = uniqueList.rows.map((x: any) =>
    x.column_names.replaceAll('{', '').replaceAll('}', '').split(',')
  );

  return result;
}

export async function buildEntitiesFilesForProject(
  projectPath: string,
  migrationMode: 'push' | 'deploy'
): Promise<EntitiesInformationFiles> {
  const postgres = new DockerizedPostgres();

  await postgres.start();

  try {
    const serverSrc = path.join(projectPath, 'src');
    const serverAssets = path.join(serverSrc, 'assets');
    const serverConfigLoader = new ConfigLoader(
      [path.join(serverAssets, 'config.json')],
      z.object({
        dbMigration: DBMigrationSchema,
      })
    );
    // your server/assets/config.json must have a property "dbMigration" which should configure the dbMigrator
    // this is already setup for the startuphafen-backend
    // loadConfig() will verify the content of this config file and throw a ZodError if it does not match
    const serverConfig = await serverConfigLoader.loadConfig();

    const dbMigration = new DbMigrator(
      serverConfig.dbMigration,
      postgres.knex,
      serverSrc,
      'dev',
      migrationMode
    );
    await dbMigration.migrate();

    const schema = await sqlts.toObject(
      {
        tableNameCasing: 'pascal',
        excludedTables: [
          'public.migration',
          'public.pct_roles',
          'public.pct_user_auth',
          'public.pct_user_role_rel',
        ],
        interfaceNameFormat: '${table}',
        typeMap: {
          Uint8Array: ['bytea'],
          string: ['timetz', 'time'],
          'Date[]': ['_date'],
        },
        globalOptionality: 'required',
      },
      postgres.knex as any
    );

    const inspector = schemaInspector(postgres.knex);
    const fks = await inspector.foreignKeys();
    const fksByTable = _.groupBy(fks, (x) => x.table);

    // special handling for the pct_user_role_assignment view, it needs to set id to not nullable!
    // This view allows to create links to user system users table without having to deal with too many properties of the internal users table
    for (const table of schema.tables) {
      if (table.name === 'pct_user_role_assignment') {
        const idc = table.columns.find((c) => c.name === 'id');
        if (idc != null) {
          idc.isPrimaryKey = true;
        }
        for (const c of table.columns) {
          c.nullable = false;
        }
      }

      // special handling: the "raw" pct_user_auth table is not visible to the entities lib, but the view is. As far as the lib is concerned,
      // all foreign keys to pct_user_auth are to the pct_user_role_assignment view instead
      for (const fk of fksByTable[table.name] ?? []) {
        if (fk.foreign_key_table === 'pct_user_auth') {
          fk.foreign_key_table = 'pct_user_role_assignment';
        }
      }
    }

    const flatObjects = sqlts.fromObject(schema, {});

    const oline = (k: string) => "'" + k.toUpperCase() + "': '" + k + "'";

    const tablesConsts = `export const TABLES = {\n${schema.tables
      .map((t) => oline(t.name))
      .join(',\n')}};`;

    const uint8ArrayKey = '"CUSTOM_TYPE_UINT_8_ARRAY"';

    const zod = generateZod({
      sourceText: flatObjects.replaceAll('Uint8Array', uint8ArrayKey),
    });

    const keySchemas = schema.tables
      .map(
        (table) =>
          `export const ${table.interfaceName[0].toLowerCase()}${table.interfaceName.substring(
            1
          )}KeysSchema = z.union([${table.columns
            .map((c) => {
              return `z.literal('${c.propertyName}')`;
            })
            .join(',')}])`
      )
      .join('\n');

    const keyTypes = schema.tables
      .map(
        (table) =>
          `export type ${
            table.interfaceName
          }KeysType = z.infer<typeof ${table.interfaceName[0].toLowerCase()}${table.interfaceName.substring(
            1
          )}KeysSchema>;`
      )
      .join('\n');

    const keyArrays = schema.tables
      .map(
        (table) =>
          `export const ${_.upperCase(table.interfaceName + 'Keys').replaceAll(
            ' ',
            '_'
          )}: ${table.interfaceName}KeysType[] = [${table.columns
            .map((c) => '"' + c.propertyName + '"')
            .join(',')}]`
      )
      .join('\n');

    if (zod.errors.length > 0) {
      console.log('WARNING ts-to-zod errors!', zod.errors);
    }

    const typesWithIdPrimaryKey = schema.tables.filter(
      (t) =>
        t.columns.findIndex(
          (c) =>
            c.isPrimaryKey &&
            c.propertyName === 'id' &&
            c.propertyType === 'number'
        ) !== -1
    );

    const zodFile = zod
      .getZodSchemasFile('delete-this-line-please')
      .split('\n')
      .filter((x) => !x.includes('delete-this-line-please'))
      .join('\n')
      .replaceAll(`z.literal(${uint8ArrayKey})`, 'z.instanceof(Uint8Array)');

    const entitySchemaTs = `
    import { AnyEntitiesConfiguration, EntityConfiguration } from '@startuphafen/entity-engine/common';


    ${zodFile}

    ${keySchemas}

    ${keyTypes}

    ${keyArrays}

    export type AllEntityKeysRecord = {
      ${typesWithIdPrimaryKey.map(
        (t) => `${t.interfaceName}: ${t.interfaceName}`
      )}
    }

    import DB_SCHEMA from './db-schema.json';
    export { DB_SCHEMA };
    
    export interface EntitiesConfiguration extends AnyEntitiesConfiguration {
      ${typesWithIdPrimaryKey
        .map(
          (t) => `${t.interfaceName}: EntityConfiguration<${t.interfaceName}>;`
        )
        .join('\n      ')}
      enumTranslations: {
        //
        ${schema.enums
          .map(
            (e) =>
              `${e.convertedName}: {[key in keyof typeof ${e.convertedName}]: string};`
          )
          .join('\n      ')}
      }
      schema: typeof DB_SCHEMA
    }
    

    export function buildEntitySchemaConfigurations() {
      const result = {
        ${typesWithIdPrimaryKey
          .map(
            (t) => `${t.interfaceName}: {
            table: DB_SCHEMA.tables.${t.name},
            zod: ${_.camelCase(t.name)}Schema,
            zodKeys: ${_.camelCase(t.name)}KeysSchema,
            keysList: ${_.upperCase(t.interfaceName + 'Keys').replaceAll(
              ' ',
              '_'
            )}
          }`
          )
          .join(',\n        ')}

        ${typesWithIdPrimaryKey.length > 0 ? ',' : ''}

        schema: DB_SCHEMA
      };

      return result;
    }

    export const STARTUPHAFEN_ENTITY_SCHEMA = buildEntitySchemaConfigurations();
    `;

    const uniques: Record<string, string[]> = {};
    for (const t of schema.tables) {
      uniques[t.name] = await getUniqueConstraintsForTable(
        t.schema,
        t.name,
        postgres.knex
      );
    }

    const schemaInformation = JSON.stringify(
      {
        tables: distinctGroupBy(
          schema.tables.map((t) => ({
            ...t,
            foreignKeys: (fksByTable[t.name] ?? []).map((x) =>
              _.omit(x, 'table')
            ),
            uniqueConstrains: uniques[t.name],
          })),
          (x) => x.name
        ),
        enums: distinctGroupBy(schema.enums, (e) => e.name),
      },
      null,
      2
    );

    return {
      entitiesFileContent:
        flatObjects + '\n' + tablesConsts + '\n' + entitySchemaTs,
      schemaInformation,
    };
  } finally {
    await postgres.stop();
  }
}
