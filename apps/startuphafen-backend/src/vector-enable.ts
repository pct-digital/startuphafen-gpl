import { Knex } from 'knex';

export async function initVectorExtension(kx: Knex) {
  // Check if pgvector extension is already enabled
  const extensionCheckResult = await kx.raw(
    `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as exists`
  );

  const isExtensionEnabled = extensionCheckResult.rows?.[0]?.exists ?? false;

  if (isExtensionEnabled) {
    console.log('pgvector extension already enabled');
  } else {
    console.log('pgvector extension not found, attempting to enable');
    try {
      // Initialize pgvector extension (handles both managed Postgres with control_extension and standard Postgres)
      await kx.raw(`
            DO $$
            BEGIN
              BEGIN
                PERFORM control_extension('create', 'vector');
              EXCEPTION
                WHEN undefined_function THEN
                  EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
              END;
            END
            $$;
          `);
      console.log('pgvector extension successfully enabled');
    } catch (error) {
      console.error('Failed to enable pgvector extension:', error);
      throw error;
    }
  }
}
