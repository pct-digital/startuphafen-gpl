// used for tests, jest & e2e. Fixes the all database sequences after inserts with given IDs
// randomizes the IDs of the sequences to increase chance tests dont just work by chance

import { Knex } from 'knex';

export async function fixSequences(knex: Knex) {
  // see https://wiki.postgresql.org/wiki/Fixing_Sequences

  // modified to add a random offset to all sequences for testing purposes

  const setvals = await knex.raw(`
    SELECT 
    'SELECT SETVAL(' ||
       quote_literal(quote_ident(sequence_namespace.nspname) || '.' || quote_ident(class_sequence.relname)) ||
       ', COALESCE(MAX(' ||quote_ident(pg_attribute.attname)|| '), 1) + 42 + floor(random() * 10000)::integer )  FROM ' ||
       quote_ident(table_namespace.nspname)|| '.'||quote_ident(class_table.relname)|| ';' as cmd
FROM pg_depend 
    INNER JOIN pg_class AS class_sequence
        ON class_sequence.oid = pg_depend.objid 
            AND class_sequence.relkind = 'S'
    INNER JOIN pg_class AS class_table
        ON class_table.oid = pg_depend.refobjid
    INNER JOIN pg_attribute 
        ON pg_attribute.attrelid = class_table.oid
            AND pg_depend.refobjsubid = pg_attribute.attnum
    INNER JOIN pg_namespace as table_namespace
        ON table_namespace.oid = class_table.relnamespace
    INNER JOIN pg_namespace AS sequence_namespace
        ON sequence_namespace.oid = class_sequence.relnamespace
ORDER BY sequence_namespace.nspname, class_sequence.relname;
    `);

  for (const row of setvals.rows) {
    await knex.raw(row.cmd);
  }
}
