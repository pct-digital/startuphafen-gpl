import { KnexConfig } from '@startuphafen/startuphafen-common';

export async function getNewestSchemaByName() {
  // const migrator = new DbMigrator();
  // return await migrator.getSearchPath();
  return '';
}

export async function setKnexSearchPath(name: string, config: KnexConfig) {
  const c: KnexConfig = config;
  c.searchPath = ['knex', name];
  return c;
}
