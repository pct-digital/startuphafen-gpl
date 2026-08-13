// this file has to be in the same dir as the assets folder to work
import { DbMigrator } from '@startuphafen/db-migration';
import { Knex } from 'knex';
import path from 'path';
import { initVectorExtension } from './vector-enable';

export function getAssetPath(assetName: string) {
  return path.join(__dirname, 'assets', assetName);
}

export async function migrateDatabase(kx: Knex, silent = true) {
  await initVectorExtension(kx);

  await new DbMigrator(kx, __dirname, silent).migrate();
}
