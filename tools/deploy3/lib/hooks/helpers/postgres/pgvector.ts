/**
 * pgvector extension helpers for PostgreSQL database operations.
 */

import { Logger } from '../../../utils/logger';
import { DatabaseSession } from './postgres';

/**
 * Get list of all installed extensions except vector.
 */
export function getExtensionsExceptVector(session: DatabaseSession): string[] {
  const rows = session.queryRows(
    `SELECT extname FROM pg_extension WHERE extname != 'vector'`
  );
  return rows.map((r) => r.extname);
}

/**
 * Detect if pgvector extension is enabled on a database.
 */
export function detectPgVectorEnabled(
  session: DatabaseSession,
  logger: Logger
): boolean {
  const result = session.queryScalar(
    `SELECT 1 FROM pg_extension WHERE extname = 'vector'`
  );
  const enabled = result === '1';
  logger.debug(`pgvector extension enabled: ${enabled}`);
  return enabled;
}

/**
 * Clear all application objects from public schema while preserving extension-owned objects.
 * This is safer than DROP SCHEMA CASCADE which would destroy control_extension on managed Postgres offerings.
 */
export function clearPublicSchemaPreservingExtensions(
  session: DatabaseSession,
  logger: Logger
): void {
  // 1. Drop all views in public schema
  const views = session.queryRows(
    `SELECT viewname FROM pg_views WHERE schemaname = 'public'`
  );
  if (views.length > 0) {
    logger.debug(
      `Dropping ${views.length} view(s): ${views
        .map((v) => v.viewname)
        .join(', ')}`
    );
    const viewNames = views.map((v) => `"${v.viewname}"`).join(', ');
    session.exec(`DROP VIEW IF EXISTS ${viewNames} CASCADE`);
  }

  // 2. Drop all tables in public schema (CASCADE handles owned sequences, indexes, constraints)
  const tables = session.queryRows(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );
  if (tables.length > 0) {
    logger.debug(
      `Dropping ${tables.length} table(s): ${tables
        .map((t) => t.tablename)
        .join(', ')}`
    );
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    session.exec(`DROP TABLE IF EXISTS ${tableNames} CASCADE`);
  }

  // 3. Drop standalone sequences (not owned by tables, not owned by extensions)
  const sequences = session.queryRows(`
    SELECT s.sequencename 
    FROM pg_sequences s
    LEFT JOIN pg_depend d ON d.objid = (quote_ident(s.schemaname) || '.' || quote_ident(s.sequencename))::regclass
      AND d.deptype = 'e'
    WHERE s.schemaname = 'public'
      AND d.objid IS NULL
  `);
  if (sequences.length > 0) {
    logger.debug(
      `Dropping ${sequences.length} standalone sequence(s): ${sequences
        .map((s) => s.sequencename)
        .join(', ')}`
    );
    const seqNames = sequences.map((s) => `"${s.sequencename}"`).join(', ');
    session.exec(`DROP SEQUENCE IF EXISTS ${seqNames} CASCADE`);
  }

  // 4. Drop enum types in public schema (Prisma enums)
  // Note: Only enums (typtype = 'e'), NOT composite types (typtype = 'c') which are auto-dropped with tables
  const enums = session.queryRows(`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
  `);
  if (enums.length > 0) {
    logger.debug(
      `Dropping ${enums.length} enum type(s): ${enums
        .map((e) => e.typname)
        .join(', ')}`
    );
    const enumNames = enums.map((e) => `"${e.typname}"`).join(', ');
    session.exec(`DROP TYPE IF EXISTS ${enumNames} CASCADE`);
  }

  // Note: We intentionally do NOT drop functions here.
  // Some managed Postgres offerings have system functions (control_extension, etc.) AND pgvector
  // functions in public schema that are NOT marked as extension-owned in pg_depend.

  logger.debug('Public schema cleared (extension objects preserved)');
}

/**
 * Enable pgvector extension on target database.
 * Handles both managed Postgres offerings (control_extension) and standard Postgres (CREATE EXTENSION).
 */
export function enablePgVector(session: DatabaseSession, logger: Logger): void {
  logger.debug('Enabling pgvector extension on target...');
  session.exec(`
    DO \\$pgvector\\$
    BEGIN
      BEGIN
        PERFORM control_extension('create', 'vector');
        RAISE NOTICE 'pgvector enabled via control_extension';
      EXCEPTION
        WHEN undefined_function THEN
          EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
          RAISE NOTICE 'pgvector enabled via CREATE EXTENSION';
      END;
    END
    \\$pgvector\\$
  `);
  logger.debug('pgvector extension enabled successfully');
}
