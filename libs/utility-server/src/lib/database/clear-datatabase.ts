import knex, { Knex } from 'knex';

export async function clearDatabase(config: Knex.Config) {
  const kx = knex(config);
  try {
    await kx.transaction(async (trx) => {
      // https://stackoverflow.com/a/21247009
      await trx.raw('DROP SCHEMA public CASCADE');
      await trx.raw('CREATE SCHEMA public');
      await trx.raw('GRANT ALL ON SCHEMA public TO public;');
      await trx.raw("COMMENT ON SCHEMA public IS 'standard public schema';");
    });
  } finally {
    await kx.destroy();
  }
}
